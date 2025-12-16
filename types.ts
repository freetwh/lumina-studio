
export interface LightNode {
  id: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  color?: string; // Current display color
  brightness?: number; // 0-1
}

export interface LightGroup {
  id: string;
  name: string;
  nodes: LightNode[];
  previewImage?: string;
  createdAt: number;
  gridConfig?: {
    rows: number;
    cols: number;
  };
}

export interface KeyframeState {
  color: string;
  brightness: number;
}

export interface Keyframe {
  id: string;
  trackId: number;
  startTime: number; // in milliseconds
  duration: number; // in milliseconds
  targetLightIds: string[];
  fromState: KeyframeState;
  toState: KeyframeState;
  animationType: string; // 'fade', 'pulse', 'flash'
}

export interface AnimationNode {
  id: string;
  name: string;
  keyframes: Keyframe[];
  duration: number; // Total duration in ms
}

export interface SavedSelection {
  id: string;
  name: string;
  lightIds: string[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  lightGroupId: string;
  animations: AnimationNode[];
  savedSelections?: SavedSelection[]; // New field for saved selections
}

export interface Template {
  id: string;
  name: string;
  lightGroupId?: string; // Optional, if template includes layout
  keyframes: Keyframe[]; // The animation data
  createdAt: number;
}

// Global Storage Structure
export interface AppData {
  projects: Project[];
  templates: Template[];
  lightGroups: LightGroup[];
}
