import { WeatherType, WeatherSettings } from '../types/traffic';

export const WEATHER_PRESETS: Record<WeatherType, WeatherSettings> = {
  CLEAR: {
    type: 'CLEAR',
    label: 'Clear Skies',
    speedMultiplier: 1.0,
    yellowExtension: 0,
    allRedExtension: 0,
    frictionCoefficient: 1.0,
    visibilityAlpha: 0.0,
  },
  RAIN: {
    type: 'RAIN',
    label: 'Moderate Rain',
    speedMultiplier: 0.78,
    yellowExtension: 1.5,
    allRedExtension: 1.0,
    frictionCoefficient: 0.75,
    visibilityAlpha: 0.25,
  },
  FOG: {
    type: 'FOG',
    label: 'Dense Fog',
    speedMultiplier: 0.65,
    yellowExtension: 2.0,
    allRedExtension: 1.5,
    frictionCoefficient: 0.85,
    visibilityAlpha: 0.45,
  },
  STORM: {
    type: 'STORM',
    label: 'Severe Storm',
    speedMultiplier: 0.50,
    yellowExtension: 3.0,
    allRedExtension: 2.5,
    frictionCoefficient: 0.55,
    visibilityAlpha: 0.55,
  },
};

export class WeatherManager {
  private currentWeather: WeatherSettings = WEATHER_PRESETS.CLEAR;

  public setWeather(type: WeatherType): WeatherSettings {
    this.currentWeather = WEATHER_PRESETS[type];
    return this.currentWeather;
  }

  public getWeather(): WeatherSettings {
    return this.currentWeather;
  }
}
