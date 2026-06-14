// railway-provisioner.service.ts — Railway API로 Private Cloud 인스턴스 자동 프로비저닝
import { pool } from '../db';
import crypto from 'crypto';

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2';

async function gql(query: string, variables: Record<string, unknown>) {
  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) throw new Error('RAILWAY_API_TOKEN 환경변수가 설정되지 않았습니다.');
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json() as { data?: Record<string, unknown>; errors?: { message: string }[] };
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data!;
}

export interface ProvisionInput {
  customerId: number;
  customerName: string;
  customerEmail: string;
  subdomain: string; // e.g. "acme" → acme.wsj-aitradebot.live
}

export interface ProvisionResult {
  railwayProjectId: string;
  railwayEnvironmentId: string;
  railwayAppServiceId: string;
  railwayDbServiceId: string;
  railwayUrl: string;
}

export async function provisionPrivateCloudInstance(input: ProvisionInput): Promise<ProvisionResult> {
  const { customerId, customerName, subdomain } = input;
  const projectName = `tradebot-${subdomain}`;

  await pool.query(
    `UPDATE private_cloud_customers SET status='provisioning' WHERE id=$1`,
    [customerId]
  );

  try {
    // 1. 프로젝트 생성
    const createProject = await gql(`
      mutation projectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) { id defaultEnvironment { id } }
      }
    `, { input: { name: projectName, isPublic: false } });

    const projectId = (createProject.projectCreate as any).id as string;
    const environmentId = (createProject.projectCreate as any).defaultEnvironment.id as string;

    // 2. PostgreSQL 서비스 생성
    const createDb = await gql(`
      mutation serviceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) { id }
      }
    `, { input: { projectId, name: 'Database', source: { image: 'postgres:15-alpine' } } });
    const dbServiceId = (createDb.serviceCreate as any).id as string;

    // 3. DB 비밀번호 생성 후 환경변수 설정
    const dbPassword = crypto.randomBytes(16).toString('hex');
    const dbName = 'tradebot';
    const dbUser = 'tradebot';

    await gql(`
      mutation variableCollectionUpsert($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input)
      }
    `, {
      input: {
        projectId, environmentId, serviceId: dbServiceId,
        variables: {
          POSTGRES_USER: dbUser,
          POSTGRES_PASSWORD: dbPassword,
          POSTGRES_DB: dbName,
        },
      },
    });

    const databaseUrl = `postgresql://${dbUser}:${dbPassword}@${dbServiceId}.railway.internal:5432/${dbName}`;

    // 4. 앱 서비스 생성 (GitHub 레포)
    const githubRepo = process.env.GITHUB_REPO || 'wsjung2023/tradebot';
    const createApp = await gql(`
      mutation serviceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) { id }
      }
    `, {
      input: {
        projectId,
        name: customerName,
        source: { repo: githubRepo },
        branch: 'main',
      },
    });
    const appServiceId = (createApp.serviceCreate as any).id as string;

    // 5. 앱 환경변수 설정
    const sessionSecret = crypto.randomBytes(32).toString('hex');
    await gql(`
      mutation variableCollectionUpsert($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input)
      }
    `, {
      input: {
        projectId, environmentId, serviceId: appServiceId,
        variables: {
          NODE_ENV: 'production',
          PORT: '8080',
          DEPLOYMENT_TIER: 'private_cloud',
          DATABASE_URL: databaseUrl,
          SESSION_SECRET: sessionSecret,
          // 고객이 설정에서 입력할 값들 (빈값으로 시작)
          OPENAI_API_KEY: '',
          GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
          GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
          RESEND_API_KEY: process.env.RESEND_API_KEY || '',
          EMAIL_FROM: `TradeBot <noreply@wsj-aitradebot.live>`,
        },
      },
    });

    // 6. Railway 기본 도메인 생성 (xxxx.up.railway.app)
    const createDomain = await gql(`
      mutation serviceInstanceDeploy($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `, { serviceId: appServiceId, environmentId }).catch(() => null);

    // Railway 자동 도메인 URL 조회
    const domainQuery = await gql(`
      query service($id: String!) {
        service(id: $id) {
          domains {
            serviceDomains { domain }
          }
        }
      }
    `, { id: appServiceId }).catch(() => null);

    const serviceDomains = (domainQuery?.service as any)?.domains?.serviceDomains ?? [];
    const railwayUrl = serviceDomains.length > 0
      ? `https://${serviceDomains[0].domain}`
      : `https://${projectName}.up.railway.app`;

    // 7. DB 업데이트
    await pool.query(`
      UPDATE private_cloud_customers SET
        status = 'active',
        railway_project_id = $1,
        railway_environment_id = $2,
        railway_app_service_id = $3,
        railway_db_service_id = $4,
        railway_url = $5,
        provisioned_at = now(),
        error_message = null
      WHERE id = $6
    `, [projectId, environmentId, appServiceId, dbServiceId, railwayUrl, customerId]);

    console.log(`[PrivateCloud] 프로비저닝 완료: customer=${customerId} project=${projectId} url=${railwayUrl}`);

    return { railwayProjectId: projectId, railwayEnvironmentId: environmentId, railwayAppServiceId: appServiceId, railwayDbServiceId: dbServiceId, railwayUrl };
  } catch (err: any) {
    await pool.query(
      `UPDATE private_cloud_customers SET status='failed', error_message=$1 WHERE id=$2`,
      [err.message, customerId]
    );
    throw err;
  }
}

export async function deprovisionPrivateCloudInstance(customerId: number): Promise<void> {
  const { rows } = await pool.query(
    `SELECT railway_project_id FROM private_cloud_customers WHERE id=$1`,
    [customerId]
  );
  const projectId = rows[0]?.railway_project_id;
  if (projectId) {
    await gql(`
      mutation projectDelete($id: String!) { projectDelete(id: $id) }
    `, { id: projectId });
  }
  await pool.query(
    `UPDATE private_cloud_customers SET status='suspended', railway_project_id=null WHERE id=$1`,
    [customerId]
  );
}
