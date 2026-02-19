import { Injectable } from "@angular/core";
import { CanDeactivate } from "@angular/router";

@Injectable({ providedIn: 'root' })
export class LeaveGuard implements CanDeactivate<any> {

  canDeactivate(component: any) {
    return component.confirmLeave ? component.confirmLeave() : true;
  }

}
