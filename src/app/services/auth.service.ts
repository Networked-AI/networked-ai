import { UserService } from '@/services/user.service';
import { BaseApiService } from '@/services/base-api.service';
import { KEYS, LocalStorageService } from './localstorage.service';
import { FirebaseAuthError } from '@/utils/firebase-error-message';
import { signal, inject, Injector, Injectable } from '@angular/core';
import { ISendOtpPayload, IVerifyOtpPayload } from '@/interfaces/IAuth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { IAuthUser, IAuthResponse, ILoginPayload, IRegisterPayload } from '@/interfaces/IAuth';
import { HttpContext } from '@angular/common/http';
import { IS_RSVP_FLOW } from '@/interceptors/request-context';

@Injectable({ providedIn: 'root' })
export class AuthService extends BaseApiService {
  // services
  private injector = inject(Injector);
  private localStorageService = inject(LocalStorageService);

  // signals
  allUsers = signal<IAuthUser[]>(this.getAccounts());
  currentUser = signal<IAuthUser | null>(this.getActiveAccount());

  // ============================================================================
  // MULTIPLE ACCOUNT MANAGEMENT
  // ============================================================================

  // returns the bearer token from the active account, or null if no account is active.
  getCurrentToken(): string | null {
    const account = this.currentUser();
    return account?.token || null;
  }

  // retrieves all stored user accounts from localStorage.
  private getAccounts(): IAuthUser[] {
    return JSON.parse(this.localStorageService.getItem(KEYS.USERS) || '[]');
  }

  // gets the currently active account (the first account in the stored accounts array).
  private getActiveAccount(): IAuthUser | null {
    return this.getAccounts()[0] || null;
  }

  // sets the given account as active by moving it to the top.
  setActiveAccount(account: IAuthUser) {
    const accounts = this.getAccounts();

    // remove if already exists
    const filtered = accounts.filter((a) => a.id !== account.id);

    // put active account at first position
    filtered.unshift(account);

    this.localStorageService.setItem(KEYS.USERS, JSON.stringify(filtered));

    // update signals
    this.allUsers.set(filtered);
    this.currentUser.set(account);
  }

  // removes the active (first) account from localStorage and promotes the next account, if any, as active.
  private removeActiveAccount(): void {
    const accounts = this.getAccounts();
    if (!accounts.length) return;

    // remove active account (index 0)
    accounts.shift();

    this.localStorageService.setItem(KEYS.USERS, JSON.stringify(accounts));

    // update signals
    this.allUsers.set(accounts);
    this.currentUser.set(accounts[0] || null);
  }

  // switches the active account to the given userId by moving it to the first position.
  switchActiveAccount(userId: string) {
    const accounts = this.getAccounts();
    const index = accounts.findIndex((a) => a.id === userId);

    if (index > 0) {
      // remove selected account and put it at first position
      const [selected] = accounts.splice(index, 1);
      accounts.unshift(selected);

      // update local storage
      this.localStorageService.setItem(KEYS.USERS, JSON.stringify(accounts));

      // update signals
      this.allUsers.set(accounts);
      this.currentUser.set(accounts[0]);
    }
  }

  // ============================================================================
  // AUTH APIs
  // ============================================================================
  async register(payload: IRegisterPayload): Promise<void> {
    const response = await this.post<IAuthResponse>('/auth/register', payload);

    // call get user and update active account with full user response
    if (response?.data?.token && response?.data?.user) {
      const userService = this.injector.get(UserService);
      const user = await userService.getUser(response.data.user.id);
      this.setActiveAccount({ ...user, token: response.data.token });
    }
  }

  async login(payload: ILoginPayload, options?: { isRsvpModal?: boolean }): Promise<IAuthResponse> {
    const context = options?.isRsvpModal ? new HttpContext().set(IS_RSVP_FLOW, true) : undefined;
    const response = await this.post<IAuthResponse>('/auth/login', payload, context ? { context } : undefined);

    // call get user and update active account with full user response
    if (response?.data?.token && response?.data?.user) {
      const userService = this.injector.get(UserService);
      const user = await userService.getUser(response.data.user.id);
      this.setActiveAccount({ ...user, token: response.data.token });
    }

    return response;
  }

  private async socialLogin(): Promise<IAuthResponse> {
    const { token: firebase_token } = await FirebaseAuthentication.getIdToken();

    if (!firebase_token) {
      throw new Error('Firebase token is required');
    }

    const response = await this.post<IAuthResponse>('/auth/social-login', { firebase_token });

    // call get user and update active account with full user response
    if (response?.data?.token && response?.data?.user) {
      const userService = this.injector.get(UserService);
      const user = await userService.getUser(response.data.user.id);
      this.setActiveAccount({ ...user, token: response.data.token });
    }

    await FirebaseAuthentication.signOut();
    return response;
  }

  async signInWithGoogle(): Promise<IAuthResponse> {
    try {
      await FirebaseAuthentication.signInWithGoogle();
      return await this.socialLogin();
    } catch (error) {
      console.error('error: ', error);
      throw new Error(FirebaseAuthError(error));
    }
  }

  async signInWithFacebook(): Promise<IAuthResponse> {
    try {
      await FirebaseAuthentication.signInWithFacebook();
      return await this.socialLogin();
    } catch (error) {
      console.error('error: ', error);
      throw new Error(FirebaseAuthError(error));
    }
  }

  async signInWithApple(): Promise<IAuthResponse> {
    try {
      await FirebaseAuthentication.signInWithApple();
      return await this.socialLogin();
    } catch (error) {
      console.error('error: ', error);
      throw new Error(FirebaseAuthError(error));
    }
  }

  async forgotPassword(email: string): Promise<void> {
    await this.post('/auth/forgot-password', { email });
  }

  async sendOtp({ email, mobile }: ISendOtpPayload): Promise<void> {
    const payload: ISendOtpPayload = {};
    if (email) payload.email = email;
    if (mobile) payload.mobile = mobile;

    await this.post('/auth/send-verification-otp', payload);
  }

  async verifyOtp({ email, mobile, code }: IVerifyOtpPayload): Promise<boolean> {
    const payload: IVerifyOtpPayload = { code };
    if (email) payload.email = email;
    if (mobile) payload.mobile = mobile;

    return await this.post<boolean>('/auth/verify-otp', payload);
  }

  async signOut(): Promise<void> {
    this.removeActiveAccount();
  }

  //Fetch current user from API on refresh and update stored account
  async refreshCurrentUser(): Promise<void> {
    const activeAccount = this.getActiveAccount();
    if (!activeAccount?.id || !activeAccount?.token) {
      return;
    }

    try {
      const userService = this.injector.get(UserService);
      const user = await userService.getUser(activeAccount.id);
      const updatedUser = { ...user, token: activeAccount.token };
      this.setActiveAccount(updatedUser);
    } catch (error) {
      console.error('Error refreshing current user on app load:', error);
    }
  }

  async changePassword(password: string, new_password: string): Promise<any> {
    try {
      const response = await this.post<any>('/auth/reset-password', { password, new_password });
      return response;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }
}
