// data-cleanup.service.ts — 오래된 거래 로그, 만료 알림 등 주기적 DB 데이터 정리 서비스
import { storage } from '../storage';
import * as cron from 'node-cron';

/**
 * 데이터 정리 서비스
 * - 오래된 데이터 자동 삭제로 DB 증가 방지
 * - 분석 데이터는 보존
 */
export class DataCleanupService {
  private cleanupJob: cron.ScheduledTask | null = null;

  /**
   * 데이터 정리 작업 시작 (매일 새벽 2시)
   */
  start() {
    console.log('🧹 Data Cleanup Service starting...');
    
    // Run cleanup daily at 2:00 AM
    this.cleanupJob = cron.schedule('0 2 * * *', async () => {
      await this.executeCleanup();
    });

    console.log('✅ Data Cleanup Service started (runs daily at 02:00)');
  }

  stop() {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      console.log('⏹️  Data Cleanup Service stopped');
    }
  }

  /**
   * 데이터 정리 실행
   */
  async executeCleanup() {
    console.log('\n🧹 Starting data cleanup cycle...');

    try {
      const cutoffDates = {
        conditionResults: this.getDaysAgo(30), // 조건검색 결과: 30일
        tradingLogs: this.getDaysAgo(90), // 거래 로그: 90일
        marketIssues: this.getDaysAgo(1095), // 시장 이슈: 3년
        financialSnapshots: this.getDaysAgo(1095), // 재무제표: 3년 (최신만 유지)
        alerts: this.getDaysAgo(365), // 알림 (트리거됨): 1년
      };

      // 1. 조건검색 결과 정리 (30일 이상)
      await this.cleanupConditionResults(cutoffDates.conditionResults);

      // 2. 거래 로그 정리 (90일 이상)
      await this.cleanupTradingLogs(cutoffDates.tradingLogs);

      // 3. 시장 이슈 정리 (3년 이상)
      await this.cleanupMarketIssues(cutoffDates.marketIssues);

      // 4. 재무제표 정리 (3년 이상 된 중복 데이터)
      await this.cleanupFinancialSnapshots(cutoffDates.financialSnapshots);

      // 5. 트리거된 알림 정리 (1년 이상)
      await this.cleanupTriggeredAlerts(cutoffDates.alerts);

      console.log('✅ Data cleanup cycle completed\n');
    } catch (error) {
      console.error('❌ Error in cleanup cycle:', error);
    }
  }

  /**
   * 조건검색 결과 정리
   */
  private async cleanupConditionResults(cutoffDate: Date) {
    console.log(`  🗑️  Cleaning condition results older than ${cutoffDate.toISOString()}`);
    
    try {
      const deletedCount = await storage.deleteConditionResultsOlderThan(cutoffDate);
      console.log(`  ✅ Deleted ${deletedCount} old condition results`);
    } catch (error) {
      console.error('  ❌ Failed to cleanup condition results:', error);
    }
  }

  /**
   * 거래 로그 정리
   */
  private async cleanupTradingLogs(cutoffDate: Date) {
    console.log(`  🗑️  Cleaning trading logs older than ${cutoffDate.toISOString()}`);
    
    try {
      const deletedCount = await storage.deleteTradingLogsOlderThan(cutoffDate);
      console.log(`  ✅ Deleted ${deletedCount} old trading logs`);
    } catch (error) {
      console.error('  ❌ Failed to cleanup trading logs:', error);
    }
  }

  /**
   * 시장 이슈 정리
   */
  private async cleanupMarketIssues(cutoffDate: Date) {
    console.log(`  🗑️  Cleaning market issues older than ${cutoffDate.toISOString()}`);
    
    try {
      const deletedCount = await storage.deleteMarketIssuesOlderThan(cutoffDate);
      console.log(`  ✅ Deleted ${deletedCount} old market issues`);
    } catch (error) {
      console.error('  ❌ Failed to cleanup market issues:', error);
    }
  }

  /**
   * 재무제표 정리 (오래된 중복 데이터만)
   */
  private async cleanupFinancialSnapshots(cutoffDate: Date) {
    console.log(`  🗑️  Cleaning financial snapshots older than ${cutoffDate.toISOString()}`);
    
    try {
      const deletedCount = await storage.deleteFinancialSnapshotsOlderThan(cutoffDate);
      console.log(`  ✅ Deleted ${deletedCount} old financial snapshots`);
    } catch (error) {
      console.error('  ❌ Failed to cleanup financial snapshots:', error);
    }
  }

  /**
   * 트리거된 알림 정리
   */
  private async cleanupTriggeredAlerts(cutoffDate: Date) {
    console.log(`  🗑️  Cleaning triggered alerts older than ${cutoffDate.toISOString()}`);
    
    try {
      const deletedCount = await storage.deleteTriggeredAlertsOlderThan(cutoffDate);
      console.log(`  ✅ Deleted ${deletedCount} old triggered alerts`);
    } catch (error) {
      console.error('  ❌ Failed to cleanup triggered alerts:', error);
    }
  }

  /**
   * N일 전 날짜 계산
   */
  private getDaysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}

export const dataCleanupService = new DataCleanupService();
