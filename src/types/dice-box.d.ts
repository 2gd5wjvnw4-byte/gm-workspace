declare module '@3d-dice/dice-box' {
  export interface DiceBoxConfig {
    container?: string;
    id?: string;
    assetPath: string;
    origin?: string;
    theme?: string;
    themeColor?: string;
    offscreen?: boolean;
    scale?: number;
    gravity?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    angularDamping?: number;
    linearDamping?: number;
    spinForce?: number;
    throwForce?: number;
    startingHeight?: number;
    settleTimeout?: number;
    delay?: number;
    enableShadows?: boolean;
    lightIntensity?: number;
    suspendSimulation?: boolean;
    onBeforeRoll?: (notation: unknown) => void;
    onDieComplete?: (die: DiceBoxDieResult) => void;
    onRollComplete?: (groups: DiceBoxRollGroup[]) => void;
    onRemoveComplete?: (die: DiceBoxDieResult) => void;
    onThemeConfigLoaded?: (themeData: unknown) => void;
    onThemeLoaded?: (themeData: unknown) => void;
  }

  export interface DiceBoxDieResult {
    groupId: number;
    rollId: number;
    sides: number | string;
    dieType?: string;
    theme?: string;
    themeColor?: string;
    value: number;
  }

  export interface DiceBoxRollGroup {
    id: number;
    qty: number;
    sides: number | string;
    modifier?: number;
    value: number;
    rolls: DiceBoxDieResult[];
  }

  export default class DiceBox {
    canvas?: HTMLCanvasElement;
    isVisible?: boolean;
    constructor(config: DiceBoxConfig);
    init(): Promise<this>;
    roll(
      notation: string | string[],
      options?: { theme?: string; themeColor?: string; newStartPoint?: boolean }
    ): Promise<DiceBoxDieResult[]>;
    clear(): this;
    hide(hideClass?: string): this;
    show(): this;
    resizeWorld(): void;
    getRollResults(): DiceBoxRollGroup[];
  }
}
