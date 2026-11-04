/**
 * Mission API Service Provider
 * AEROVATA by TASPORA
 * 
 * Provides runtime switching between:
 * 1. 'mock' - Standalone in-memory simulation controller
 * 2. 'http' - External production REST API
 * 3. 'px4'  - Genuine PX4 Autopilot SITL & Gazebo MAVLink integration
 */

import type { IMissionApiAdapter } from './types';
import { MockMissionApiAdapter } from './MockMissionApiAdapter';
import { HttpMissionApiAdapter } from './HttpMissionApiAdapter';
import { Px4SitlAdapter } from '../px4/Px4SitlAdapter';
import { SimulationMissionController } from '../../controller/SimulationMissionController';

export type ApiMode = 'mock' | 'http' | 'px4';

class ApiServiceManager {
  private mode: ApiMode = 'mock';
  private mockAdapter: MockMissionApiAdapter;
  private httpAdapter: HttpMissionApiAdapter;
  private px4Adapter: Px4SitlAdapter;
  private controller: SimulationMissionController;

  constructor() {
    this.controller = new SimulationMissionController();
    this.mockAdapter = new MockMissionApiAdapter(this.controller);
    this.httpAdapter = new HttpMissionApiAdapter();
    this.px4Adapter = new Px4SitlAdapter();
  }

  public getAdapter(): IMissionApiAdapter {
    if (this.mode === 'px4') return this.px4Adapter;
    if (this.mode === 'http') return this.httpAdapter;
    return this.mockAdapter;
  }

  public getMode(): ApiMode {
    return this.mode;
  }

  public setMode(mode: ApiMode): void {
    this.mode = mode;
  }

  public getController(): SimulationMissionController {
    return this.controller;
  }

  public getMockAdapter(): MockMissionApiAdapter {
    return this.mockAdapter;
  }

  public getHttpAdapter(): HttpMissionApiAdapter {
    return this.httpAdapter;
  }

  public getPx4Adapter(): Px4SitlAdapter {
    return this.px4Adapter;
  }

  public getBaseUrl(): string {
    return this.getAdapter().getBaseUrl();
  }

  public setBaseUrl(url: string): void {
    if (this.mode === 'px4') {
      this.px4Adapter.setBaseUrl(url);
    } else if (this.mode === 'http') {
      this.httpAdapter.setBaseUrl(url);
    } else {
      this.mockAdapter.setBaseUrl(url);
    }
  }
}

export const apiService = new ApiServiceManager();
export * from './types';
export * from './missionPresets';
export { MockMissionApiAdapter, HttpMissionApiAdapter, Px4SitlAdapter };
