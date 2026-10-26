import { Color3,MeshBuilder,StandardMaterial,TransformNode,type Mesh } from '@babylonjs/core';
import type { MonsterVisualRenderer } from './MonsterVisualRenderer';
import type { VisualBattlefield,VisualMonster } from './monsterVisual.types';
export class MonsterLayoutHelpers {
    private readonly renderer: MonsterVisualRenderer;
    static readonly key = 'layout';
    private readonly scene;
    private readonly gridRoot: TransformNode;
    private readonly markers = new Map<string, {
        mesh: Mesh;
        width: number;
    }>();
    private gridSignature = '';
    private gridLayout: {
        battlefield: VisualBattlefield;
        rowCount: number;
    } | null = null;
    private selectedId = '';
    private readonly offRemove: () => void;
    private helpersVisible = true;
    constructor(renderer: MonsterVisualRenderer) {
        this.renderer = renderer;
        this.scene = renderer.scene;
        this.gridRoot = new TransformNode('monsterFormationGrid', this.scene);
        this.offRemove = renderer.onRemove(id => {
            const entry = this.markers.get(id);
            entry?.mesh.material?.dispose(); entry?.mesh.dispose(); this.markers.delete(id);
        });
    }
    setHelpersVisible(visible: boolean): void {
        this.helpersVisible = visible;
        this.gridRoot.setEnabled(visible);
        if (!visible) {
            this.clearGrid();
            this.clearMarkers();
        }
        else if (this.gridLayout)
            this.sync(this.gridLayout.battlefield, this.selectedId, this.gridLayout.rowCount);
    }
    sync(battlefield: VisualBattlefield, selectedId: string, rowCount: number): void {
        this.selectedId = selectedId;
        this.syncGrid(battlefield, rowCount);
        if (!this.helpersVisible)
            return;
        const ids = new Set(battlefield.monsters.map(m => m.id));
        for (const [id, marker] of this.markers)
            if (!ids.has(id) || !this.renderer.has(id)) {
                marker.mesh.material?.dispose();
                marker.mesh.dispose();
                this.markers.delete(id);
            }
        for (const item of battlefield.monsters) {
            if (!this.renderer.has(item.id))
                continue;
            const width = this.calculateMarkerWidth(item, battlefield);
            let entry = this.markers.get(item.id);
            if (!entry) {
                const mesh = MeshBuilder.CreateBox('marker_' + item.id, { width, depth: .14, height: .08 }, this.scene);
                mesh.material = new StandardMaterial('markerMaterial_' + item.id, this.scene);
                mesh.isPickable = false;
                entry = { mesh, width };
                this.markers.set(item.id, entry);
            }
            entry.mesh.scaling.x *= width / entry.width;
            entry.width = width;
            const material = entry.mesh.material as StandardMaterial;
            material.alpha = .72;
            material.diffuseColor = item.position.isOccupyingFullRowCentered ? new Color3(1, .42, .08)
                : item.id === selectedId ? new Color3(.2, 1, .65) : new Color3(.2, .65, 1);
            material.emissiveColor = material.diffuseColor.scale(.5);
        }
        this.update();
    }
    update(): void {
        for (const [id, entry] of this.markers) {
            const position = this.renderer.getMonsterWorldPosition(id);
            if (position)
                entry.mesh.position.set(position.x, -2.03, position.z);
        }
    }
    private clearGrid(): void {
        const meshes = this.gridRoot.getChildMeshes();
        const materials = new Set(meshes.map(mesh => mesh.material));
        meshes.forEach(mesh => mesh.dispose());
        materials.forEach(material => material?.dispose());
        this.gridSignature = '';
    }
    private syncGrid(battlefield: VisualBattlefield, rowCount: number): void {
        this.gridLayout = { battlefield, rowCount };
        if (!this.helpersVisible)
            return;
        const signature = `${battlefield.id}|${battlefield.width}|${battlefield.cellSize}|${battlefield.rowSpacing}|${rowCount}`;
        if (signature === this.gridSignature)
            return;
        this.clearGrid();
        this.gridSignature = signature;
        const material = new StandardMaterial(`placementGrid_${Date.now()}`, this.scene);
        material.diffuseColor = new Color3(0.12, 0.45, 0.68);
        material.emissiveColor = new Color3(0.03, 0.15, 0.24);
        material.alpha = 0.34;
        for (let row = 0; row < rowCount; row += 1) {
            for (let column = 0; column < battlefield.width; column += 1) {
                const cell = MeshBuilder.CreateBox(`cell_${row}_${column}`, {
                    width: battlefield.cellSize - 0.08,
                    depth: Math.min(battlefield.cellSize, battlefield.rowSpacing) - 0.08,
                    height: 0.035
                }, this.scene);
                cell.position.set((column + 0.5 - battlefield.width / 2) * battlefield.cellSize, -2.105, -row * battlefield.rowSpacing);
                cell.material = material;
                cell.parent = this.gridRoot;
                cell.isPickable = false;
            }
        }
    }
    private calculateMarkerWidth(item: VisualMonster, battlefield: VisualBattlefield): number {
        return item.position.isOccupyingFullRowCentered
            ? Math.max(0.2, battlefield.width * battlefield.cellSize - 0.12)
            : Math.max(0.2, item.position.size * battlefield.cellSize - 0.12);
    }
    private clearMarkers(): void { for (const { mesh } of this.markers.values()) {
        mesh.material?.dispose();
        mesh.dispose();
    } this.markers.clear(); }
    clear(): void { this.clearMarkers(); this.clearGrid(); this.gridLayout = null; }
    dispose(): void { this.clear(); this.offRemove(); this.gridRoot.dispose(); }
}
