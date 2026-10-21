/**
 * SQL 함수 인자에 NULL을 넘길 때 쓴다. supabase 생성 타입은 함수 인자의 NULL 허용을 표현하지 못해
 * (모든 인자가 non-null로 생성됨) 타입만 맞춘다 — 실제로 null이 전송되고 함수가 null을 처리한다.
 */
export const sqlNull = <T>(value: T | null): T => value as T;
