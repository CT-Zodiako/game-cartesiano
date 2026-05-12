// ── Phaser 3 Ambient Declarations ────────────────────────────────────────
// Phaser se carga por CDN — declaramos solo lo que usamos para no romper el build

declare module 'phaser' {
  export class Scene extends Phaser.Events.EventEmitter {
    constructor(key?: string);
    readonly scene: this;
    readonly sys: SceneSys;
    add: GameObjects.GameObjectFactory;
    children: DisplayList;
    cache: Cache.CacheManager;
    cameraSystem: Cameras2D.CameraManager;
    cameras: Cameras2D.CameraManager;
    clock: Time.Clock;
    data: Data.DataManager;
    scenePlugin: ScenePlugin;
    load: Loader.LoaderPlugin;
    make: Make.MakeConfigs;
    input: Input.InputPlugin;
    lights: Lights.LightManager;
    load: Loader.LoaderPlugin;
    matter: MatterJs.GameObjectCreator;
    physics: Physics.PhysicsCreator;
    plugins: Plugins.PluginManager;
    sound: Sound.SoundManager;
    scale: Scale.ScaleManager;
    time: Time.Clock;
    textures: Textures.TextureManager;
    tweens: Tween.TweenManager;
    registry: Data.DataManager;
    renderer: Renderer.WebGLRenderer | Renderer.CanvasRenderer;

    create(data?: unknown): void;
    update(time: number, delta: number): void;
    shutdown(): void;
    start(key: string, data?: unknown): void;
    stop(): void;

    add: {
      graphics(): GameObjects.Graphics;
      triangle(x: number, y: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, fillColor?: number): GameObjects.Triangle;
      text(x: number, y: number, text?: string, style?: Text.TextStyle): GameObjects.Text;
      zone(x: number, y: number, width: number, height: number): GameObjects.Zone;
    };

    load: {
      on(event: string, callback: (...args: unknown[]) => void, context?: unknown): this;
      image(key: string, url: string): this;
    };

    add: {
      existing(object: GameObjects.GameObject): GameObjects.GameObject;
    };
  }

  interface SceneSys {
    displayList: DisplayList;
    updateList: UpdateList;
    settings: { status: number };
    isRunning(): boolean;
    start(key: string, data?: unknown): void;
    stop(): void;
    launch(key: string, data?: unknown): void;
    sleep(key: string): void;
    wake(key: string): void;
  }

  class Graphics extends GameObjects.GameObject {
    clear(): this;
    fillStyle(color: number, alpha?: number): this;
    fillRect(x: number, y: number, width: number, height: number): this;
    lineStyle(lineWidth: number, color: number, alpha?: number): this;
    lineBetween(x1: number, y1: number, x2: number, y2: number): this;
    lineTo(x: number, y: number): this;
    fillPoints(points: { x: number; y: number }[], closeShape?: boolean): this;
  }

  class Zone extends GameObjects.GameObject {
    setOrigin(originX: number, originY: number): this;
    setInteractive(handler?: InputHandler): this;
    setSize(width: number, height: number): this;
    on(event: 'pointerdown', handler: (pointer: InputPointer) => void): this;
  }

  class Text extends GameObjects.GameObject {
    setText(value: string | string[]): this;
    setOrigin(x: number, y: number): this;
    setStyle(style: Text.TextStyle): this;
    setPosition(x: number, y: number): this;
  }

  class Triangle extends GameObjects.GameObject {
    setOrigin(originX: number, originY: number): this;
    setPosition(x: number, y: number): this;
    setRotation(radians: number): this;
  }

  class GameObjects {
    static Graphics = Graphics;
    static Zone = Zone;
    static Text = Text;
    static Triangle = Triangle;
    static GameObject: GameObject;
    static GameObjectFactory: GameObjectFactory;
  }

  interface GameObject extends Phaser.Events.EventEmitter {
    setPosition(x: number, y: number): this;
    setOrigin(x: number, y?: number): this;
    setRotation(radians: number): this;
    setSize(w: number, h: number): this;
    setVisible(value: boolean): this;
    destroy(fromScene?: boolean): void;
  }

  interface GameObjectFactory {
    graphics(): Graphics;
    zone(x: number, y: number, width: number, height: number): Zone;
    triangle(x: number, y: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, fillColor?: number): Triangle;
    text(x: number, y: number, text?: string, style?: Text.TextStyle): Text;
  }

  interface InputHandler {
    on(event: 'pointerdown', handler: (pointer: InputPointer) => void): void;
  }

  interface InputPointer {
    x: number;
    y: number;
  }

  class Game {
    constructor(config: GameConfig);
    readonly scene: SceneManager;
    readonly scale: Scale.ScaleManager;
    destroy(): void;
  }

  interface GameConfig {
    type: number;
    parent: HTMLElement | string;
    width?: number;
    height?: number;
    backgroundColor?: string | number;
    scene?: Scene[];
    scale?: Scale.ScaleConfig;
  }

  namespace Scale {
    interface ScaleConfig {
      mode?: number;
      autoCenter?: number;
    }
    class ScaleManager {
      resize(width: number, height: number): void;
    }
    const RESIZE: number;
    const CENTER_BOTH: number;
  }

  namespace Math {
    const PI2: number;
    function Clamp(value: number, min: number, max: number): number;
  }

  const AUTO: number;
  const CENTER_BOTH: number;
  const RESIZE: number;
}

declare module 'phaser/src/scene' {
  export * from 'phaser';
}
