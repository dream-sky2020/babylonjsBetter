import { GAME_EVENTS } from "../event/events.js";

export class RhythmModule {
  constructor(eventBus, manager, options = {}) {
    this.eventBus = eventBus;
    this.manager = manager;
    this.laneY = options.laneY || [-2, 0, 2];
    this.startX = options.startX ?? -5;
    this.endX = options.endX ?? 5;
    this.travelDurationMs = options.travelDurationMs ?? 6000;
    this.speedMultiplier = options.speedMultiplier ?? 1;
    this.judgeRange = options.judgeRange ?? 0.45;

    this.judgeLineId = "rhythm-judge-line";
    this.trackIds = [];
    this.noteData = new Map();
    this.unsubscribers = [];
    this.isRunning = false;
    this.lineX = this.startX;
    this.judgeLineMesh = null;
    this.judgeLineAnimatable = null;
  }

  init() {
    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.RHYTHM_TEST_TRIGGER, () => {
        this.eventBus.emit(GAME_EVENTS.RHYTHM_START, {
          notes: [
            { lane: 0, x: -3.6 },
            { lane: 1, x: -2.1 },
            { lane: 2, x: -0.4 },
            { lane: 1, x: 1.2 },
            { lane: 0, x: 2.8 }
          ]
        });
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.RHYTHM_START, (data) => {
        this.startRhythm(data);
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.INPUT_TRIGGER, (payload) => {
        this._judge(payload);
      })
    );
  }

  destroy() {
    this._stopLoop();
    this._clearStage();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
  }

  startRhythm(data) {
    this._stopLoop();
    this._clearStage();
    this._createTracks();
    this._createJudgeLine();

    // 关键点：立即缓存这个 Mesh，不要在循环里查 Map
    const entity = this.manager.entities.get(this.judgeLineId);
    this.judgeLineMesh = entity ? entity.mesh : null;
    

    this._createNotes(data?.notes);

    const requestedMultiplier = Number(data?.speedMultiplier);
    if (Number.isFinite(requestedMultiplier) && requestedMultiplier > 0) {
      this.speedMultiplier = requestedMultiplier;
    }

    this.isRunning = true;
    this.lineX = this.startX;
    this._startJudgeLineAnimation();
  }
  _createTracks() {
    const { BABYLON } = window;
    this.trackIds = this.laneY.map((y, lane) =>
      this.manager.addObject("line", {
        id: `rhythm-track-${lane}`,
        isCustomControlled: true,
        points: [
          new BABYLON.Vector3(this.startX, y, 0),
          new BABYLON.Vector3(this.endX, y, 0)
        ]
      })
    );
  }

  _createJudgeLine() {
    const { BABYLON } = window;
    this.manager.addObject("line", {
      id: this.judgeLineId,
      isCustomControlled: true,
      points: [
        new BABYLON.Vector3(0, this.laneY[0] - 0.7, 0),
        new BABYLON.Vector3(0, this.laneY[this.laneY.length - 1] + 0.7, 0)
      ],
      position: { x: this.startX, y: 0, z: 0 }
    });
    const line = this.manager.entities.get(this.judgeLineId).mesh;
    line.renderingGroupId = 2; 
  }

  _createNotes(notes) {
    const defaultNotes = [];
    for (let lane = 0; lane < this.laneY.length; lane += 1) {
      defaultNotes.push({ lane, x: -2.5 + lane * 2 });
      defaultNotes.push({ lane, x: 1.5 + lane * 1.2 });
    }

    const source = Array.isArray(notes) && notes.length > 0 ? notes : defaultNotes;
    source.forEach((note, idx) => {
      const lane = Number.isInteger(note.lane) ? note.lane : 0;
      if (lane < 0 || lane >= this.laneY.length) {
        return;
      }
      const x = typeof note.x === "number" ? note.x : this.startX + 1 + idx;
      const id = `rhythm-note-${idx}`;
      this.manager.addObject("plane", {
        id,
        isCustomControlled: true,
        width: 0.5,
        height: 0.5,
        color: "#f59e0b",
        position: { x, y: this.laneY[lane], z: 0 }
      });
      this.noteData.set(id, { lane, x });
    });
  }

  _judge(inputPayload) {
    if (!this.isRunning) {
      return;
    }
    this.lineX = this.judgeLineMesh ? this.judgeLineMesh.position.x : this.startX;

    this.eventBus.emit(GAME_EVENTS.RHYTHM_JUDGE_TRIGGERED, {
      lineX: this.lineX,
      input: inputPayload
    });

    let bestId = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const [id, note] of this.noteData.entries()) {
      if (inputPayload?.lane !== undefined && note.lane !== inputPayload.lane) {
        continue;
      }
      const distance = Math.abs(note.x - this.lineX);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    }

    if (bestId && bestDistance <= this.judgeRange) {
      const note = this.noteData.get(bestId);
      this.noteData.delete(bestId);
      this.manager.removeObject(bestId);
      this.eventBus.emit(GAME_EVENTS.RHYTHM_NOTE_HIT, {
        id: bestId,
        lane: note.lane,
        distance: bestDistance
      });
      return;
    }

    this.eventBus.emit(GAME_EVENTS.RHYTHM_NOTE_MISS, {
      lineX: this.lineX,
      lane: inputPayload?.lane
    });
  }

  _stopLoop() {
    this.isRunning = false;
    if (this.judgeLineAnimatable) {
      this.judgeLineAnimatable.stop();
      this.judgeLineAnimatable = null;
    }
  }

  _clearStage() {
    this.trackIds.forEach((id) => this.manager.removeObject(id));
    this.trackIds = [];
    this.noteData.forEach((_, id) => this.manager.removeObject(id));
    this.noteData.clear();
    this.manager.removeObject(this.judgeLineId);
    this.judgeLineMesh = null;
  }

  _startJudgeLineAnimation() {
    const { BABYLON } = window;
    if (!this.judgeLineMesh) {
      return;
    }

    this.judgeLineMesh.animations = [];

    const frameRate = 60;
    const anim = new BABYLON.Animation(
      "lineMoveAnim",
      "position.x",
      frameRate,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const safeMultiplier = Number(this.speedMultiplier) > 0 ? Number(this.speedMultiplier) : 1;
    const effectiveDurationMs = this.travelDurationMs / safeMultiplier;
    const totalFrames = (effectiveDurationMs / 1000) * frameRate;
    anim.setKeys([
      { frame: 0, value: this.startX },
      { frame: totalFrames, value: this.endX }
    ]);

    this.judgeLineMesh.animations.push(anim);
    this.judgeLineAnimatable = this.manager.scene.beginAnimation(
      this.judgeLineMesh,
      0,
      totalFrames,
      false
    );
    this.judgeLineAnimatable.onAnimationEnd = () => {
      this.isRunning = false;
      this.judgeLineAnimatable = null;
      this.lineX = this.endX;
    };
  }
}
