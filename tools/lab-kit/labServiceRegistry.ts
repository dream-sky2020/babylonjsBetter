export class LabServiceRegistry {
  private readonly services = new Map<string, unknown>();

  set<T>(key: string, value: T): void {
    this.services.set(key, value);
  }

  get<T>(key: string): T {
    if (!this.services.has(key)) throw new Error(`Lab 服务“${key}”尚未注册。`);
    return this.services.get(key) as T;
  }

  find<T>(key: string): T | undefined {
    return this.services.get(key) as T | undefined;
  }

  delete(key: string): void {
    this.services.delete(key);
  }

  clear(): void {
    this.services.clear();
  }
}
