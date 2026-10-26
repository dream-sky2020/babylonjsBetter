import type { MonsterVisualChannel } from './monsterVisual.types';
/** Keeps existing replacement rules explicit; optional capabilities register their own cancellation. */
export class MonsterActionCoordinator {
    private readonly stops = new Map<MonsterVisualChannel, (id: string) => void>();
    register(kind: MonsterVisualChannel, stop: (id: string) => void): () => void {
        if (this.stops.has(kind))
            throw new Error(`Duplicate monster capability: ${kind}`);
        this.stops.set(kind, stop);
        return () => { this.stops.delete(kind); };
    }
    beforePlay(kind: MonsterVisualChannel, id: string): void {
        const conflicts: Record<MonsterVisualChannel, MonsterVisualChannel[]> = {
            movement: ['attack'], attack: ['movement'], hit: [], death: ['movement', 'attack', 'hit'],
        };
        for (const other of conflicts[kind])
            this.stops.get(other)?.(id);
    }
}
