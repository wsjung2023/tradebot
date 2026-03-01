// index.ts — 스토리지 레이어 진입점. 전체 앱에서 import { storage } from "../storage" 로 사용
import type { IStorage } from "./interface";
import { PostgreSQLStorage } from "./postgres.storage";

export type { IStorage } from "./interface";
export { PostgreSQLStorage } from "./postgres.storage";

// 실제 사용할 스토리지 인스턴스 (PostgreSQL)
export const storage: IStorage = new PostgreSQLStorage();
