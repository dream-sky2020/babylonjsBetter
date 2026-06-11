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

    this.perfectRange = options.perfectRange ?? 0.15; // 完美判定距离
    this.greatRange = options.greatRange ?? 0.30;     // 优秀判定距离
    this.judgeRange = options.judgeRange ?? 0.45;     // 最大判定范围 (在这个范围内但大于 greatRange 算作过早/过晚的 Miss)\
    this.missRange = options.missRange ?? 0.60;     // 超过judgeRange且小于missRange算作Miss

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

    // 2. 新增：在这里监听全局确认事件！
    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.INPUT_CONFIRM, (payload) => {
        // 当接收到确认事件时，触发你的判定逻辑
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

    const isGlobalConfirm = inputPayload?.lane === undefined;

    // --- 核心修改：使用 Map 记录【每个轨道】中距离最近的音符 ---
    // Key: lane (轨道ID), Value: { id, note, distance }
    const closestNotesPerLane = new Map();

    for (const [id, note] of this.noteData.entries()) {
      // 1. 如果是单轨道输入，直接过滤掉其他轨道的音符
      if (!isGlobalConfirm && note.lane !== inputPayload.lane) {
        continue;
      }
      
      const distanceX = Math.abs(note.x - this.lineX);
      
      // 2. 仅在判定范围内进行打擂台
      if (distanceX <= this.judgeRange) {
        const existingClosest = closestNotesPerLane.get(note.lane);
        
        // 3. 如果该轨道还没记录过音符，或者当前音符比已记录的更近，则占领该轨道！
        if (!existingClosest || distanceX < existingClosest.distance) {
          closestNotesPerLane.set(note.lane, { id, note, distance: distanceX });
        }
      }
    }

    // --- 批量处理找出的最近音符（每个轨道最多 1 个） ---
    if (closestNotesPerLane.size > 0) {
      closestNotesPerLane.forEach((closestNoteData, lane) => {
        const { id, note, distance } = closestNoteData;

        // 数据清理与画面移除
        this.noteData.delete(id);
        this.manager.removeObject(id);
        
        // 判定分级逻辑
        let judgeEventName;
        if (distance <= this.perfectRange) {
          judgeEventName = GAME_EVENTS.RHYTHM_NOTE_PERFECT;
        } else if (distance <= this.greatRange) {
          judgeEventName = GAME_EVENTS.RHYTHM_NOTE_GREAT;
        } else {
          judgeEventName = GAME_EVENTS.RHYTHM_NOTE_HIT; 
        }

        // 派发事件
        this.eventBus.emit(judgeEventName, {
          id: id,
          lane: note.lane, 
          x: note.x,
          y: this.laneY[note.lane] ?? 0,
          distance: distance 
        });
      });
      
      return; // 只要有任何轨道命中，就视为有效击打，结束函数
    }

    // 所有受检查的轨道都没有命中，触发 Miss
    this.eventBus.emit(GAME_EVENTS.RHYTHM_NOTE_MISS, {
      lineX: this.lineX,
      lane: inputPayload?.lane,
      y: Number.isInteger(inputPayload?.lane) ? this.laneY[inputPayload.lane] ?? 0 : 0
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
