import { AccidentEvent, Approach, IntersectionState } from '../types/traffic';

export class AccidentManager {
  private activeAccidents: Map<string, AccidentEvent> = new Map();

  public triggerAccident(
    intersectionId: string,
    approach: Approach,
    lane: number = 0,
    description?: string
  ): AccidentEvent {
    const key = `${intersectionId}_${approach}`;
    const event: AccidentEvent = {
      intersectionId,
      approach,
      lane,
      description: description || `Collision on ${approach} approach of ${intersectionId}`,
      timestamp: Date.now(),
    };
    this.activeAccidents.set(key, event);
    return event;
  }

  public clearAccident(intersectionId: string, approach: Approach): boolean {
    const key = `${intersectionId}_${approach}`;
    return this.activeAccidents.delete(key);
  }

  public clearAllAccidents(): void {
    this.activeAccidents.clear();
  }

  public getAccident(intersectionId: string, approach: Approach): AccidentEvent | undefined {
    return this.activeAccidents.get(`${intersectionId}_${approach}`);
  }

  public getAllAccidents(): AccidentEvent[] {
    return Array.from(this.activeAccidents.values());
  }

  public isLaneBlocked(intersectionId: string, approach: Approach): boolean {
    return this.activeAccidents.has(`${intersectionId}_${approach}`);
  }

  public applyAccidentImpact(intersection: IntersectionState): void {
    const keyPrefix = `${intersection.id}_`;
    let foundAccident = false;

    for (const [k, event] of this.activeAccidents.entries()) {
      if (k.startsWith(keyPrefix)) {
        intersection.hasAccident = true;
        intersection.accidentApproach = event.approach;
        intersection.accidentLane = event.lane;
        foundAccident = true;
        break;
      }
    }

    if (!foundAccident) {
      intersection.hasAccident = false;
      intersection.accidentApproach = null;
    }
  }
}
