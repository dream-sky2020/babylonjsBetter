declare const serviceType: unique symbol;

/** The type is carried by the key, not selected independently at each lookup. */
export type ServiceToken<T> = Readonly<{
  id: string;
  [serviceType]?: (value: T) => T;
}>;

export const createServiceToken = <T>(id: string): ServiceToken<T> => {
  if (!id.trim()) throw new Error('服务 Token ID 不能为空。');
  return Object.freeze({ id });
};