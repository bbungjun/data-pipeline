import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import * as schema from './schema.js';
declare class DatabaseConnectionPool {
    private static instance;
    private pool;
    private db;
    private isInitialized;
    private constructor();
    static getInstance(): DatabaseConnectionPool;
    getDB(): NodePgDatabase<typeof schema>;
    getPool(): Pool;
    getClient(): Promise<PoolClient>;
    testConnection(): Promise<boolean>;
    initialize(): Promise<boolean>;
    close(): Promise<void>;
    isReady(): boolean;
}
export declare const dbConnectionPool: DatabaseConnectionPool;
export declare const db: NodePgDatabase<typeof schema>;
export declare const getPool: () => Pool;
export declare const getClient: () => Promise<PoolClient>;
export declare const testConnection: () => Promise<boolean>;
export declare const initializeDB: () => Promise<boolean>;
export declare const closeDB: () => Promise<void>;
export declare const isDBReady: () => boolean;
export type TransactionType = Parameters<Parameters<typeof db.transaction>[0]>[0];
export {};
