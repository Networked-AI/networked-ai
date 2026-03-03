import { HttpContextToken } from '@angular/common/http';

export const IS_RSVP_FLOW = new HttpContextToken<boolean>(() => false);

