import { IUser } from './IUser';

export type RSVPStatus = 'Yes' | 'Maybe' | 'No' | (string & {});

export type OrderDirection = 'ASC' | 'DESC';

export interface IPagination {
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export interface IListParamsBase {
  page?: number;
  limit?: number;
  search?: string;
  order_by?: string;
  order_direction?: OrderDirection;
}

export interface IEventAttendeeTicket {
  id?: string;
  name?: string;
  ticket_type?: string;
}

export interface IEventAttendee {
  id: string;
  event_id?: string;
  user_id?: string;
  parent_user_id?: string | null;

  name?: string;
  is_incognito?: boolean;
  rsvp_status?: RSVPStatus;
  is_checked_in?: boolean;

  event_ticket_id?: string;
  amount_paid?: number;
  platform_fee_amount?: number;
  host_payout_amount?: number;
  created_at?: string;

  user?: IUser;
  event_ticket?: IEventAttendeeTicket;
}

export interface IGetEventAttendeesParams extends IListParamsBase {
  rsvp_status?: RSVPStatus;
  is_checked_in?: boolean;
  ticket_type?: string;
  is_connected?: boolean;
}

export interface IGetEventAttendeesListParams extends IListParamsBase {
  order_by?: 'name' | 'created_at';
  rsvp_status?: RSVPStatus;
}

export interface IEventAttendeesSummary {
  total_yes_guest: number;
  total_maybe_guest: number;
  total_no_guest: number;
}

export interface IEventAttendeesCounts {
  total_guest: number;
  total_attending_guest: number;
  total_maybe_guest: number;
  total_no_guest: number;
  total_checkedin_guest: number;
}

export interface IGetEventAttendeesListResult {
  data: IEventAttendee[];
  pagination: IPagination;
  summary?: IEventAttendeesSummary;
}

export interface IGetEventAttendeesResult {
  data: IEventAttendee[];
  pagination: IPagination;
  counts?: IEventAttendeesCounts;
}

export type EventParticipantRole = 'Host' | 'CoHost' | 'Sponsor' | 'Speaker' | (string & {});

export interface IEventParticipant {
  id: string;
  role?: EventParticipantRole;
  user?: IUser;
}

export interface IGetEventParticipantsListParams extends IListParamsBase {
  role?: EventParticipantRole;
  order_by?: 'name' | 'role' | 'created_at';
}

export interface IGetEventParticipantsListResult {
  data: IEventParticipant[];
  pagination: IPagination;
}
