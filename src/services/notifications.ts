import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Task } from '../types';

const CHANNEL_ID = 'planflow_tasks';
const REMINDER_LEAD_MS = 15 * 60 * 1000;
const MIN_SCHEDULE_DELAY_MS = 15_000;

export type NotificationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

function taskIdToNotificationId(taskId: string): number {
  let hash = 0;
  for (let i = 0; i < taskId.length; i += 1) {
    hash = (hash << 5) - hash + taskId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483646 + 1;
}

function parseTaskTime(time?: string): { hours: number; minutes: number } | null {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return { hours, minutes };
}

function isTodayOrFuture(year: number, month: number, day: number): boolean {
  const taskDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  return taskDay.getTime() >= Date.now();
}

export function getTaskReminderDate(task: Task): Date | null {
  if (task.completed) return null;

  const [year, month, day] = task.date.split('-').map(Number);
  if (!year || !month || !day) return null;
  if (!isTodayOrFuture(year, month, day)) return null;

  const parsedTime = parseTaskTime(task.time);
  let hours = 9;
  let minutes = 0;
  let hasExplicitTime = false;

  if (parsedTime) {
    hours = parsedTime.hours;
    minutes = parsedTime.minutes;
    hasExplicitTime = true;
  }

  const taskAt = new Date(year, month - 1, day, hours, minutes, 0, 0);
  let reminderAt = hasExplicitTime
    ? new Date(taskAt.getTime() - REMINDER_LEAD_MS)
    : taskAt;

  const earliest = Date.now() + MIN_SCHEDULE_DELAY_MS;
  if (reminderAt.getTime() < earliest) {
    reminderAt = new Date(earliest);
  }

  return reminderAt;
}

export function isNativeNotificationsSupported(): boolean {
  return Capacitor.isNativePlatform();
}

async function ensureAndroidChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;

  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Task Reminders',
    description: 'Reminders for your scheduled Planflow tasks',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#1e3a8a',
  });
}

async function ensureExactAlarmPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return true;

  const current = await LocalNotifications.checkExactNotificationSetting();
  if (current.exact_alarm === 'granted') return true;

  const updated = await LocalNotifications.changeExactNotificationSetting();
  return updated.exact_alarm === 'granted';
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (!isNativeNotificationsSupported()) return 'unsupported';

  const displayPermission = await LocalNotifications.checkPermissions();
  if (displayPermission.display === 'denied') return 'denied';
  if (displayPermission.display !== 'granted') return 'prompt';

  if (Capacitor.getPlatform() === 'android') {
    const exactPermission = await LocalNotifications.checkExactNotificationSetting();
    if (exactPermission.exact_alarm === 'denied') return 'denied';
    if (exactPermission.exact_alarm !== 'granted') return 'prompt';
  }

  return 'granted';
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!isNativeNotificationsSupported()) return false;

  const displayPermission = await LocalNotifications.checkPermissions();
  if (displayPermission.display !== 'granted') {
    const requested = await LocalNotifications.requestPermissions();
    if (requested.display !== 'granted') return false;
  }

  await ensureAndroidChannel();

  const exactGranted = await ensureExactAlarmPermission();
  return exactGranted;
}

function buildNotificationPayload(task: Task, at: Date) {
  const parsedTime = parseTaskTime(task.time);
  const body = parsedTime
    ? `Starts at ${task.time} • ${task.category}`
    : `Due today at 9:00 AM • ${task.category}`;

  return {
    id: taskIdToNotificationId(task.id),
    title: task.isGoal ? `Goal reminder: ${task.title}` : `Reminder: ${task.title}`,
    body,
    schedule: { at, allowWhileIdle: true },
    channelId: CHANNEL_ID,
    smallIcon: 'ic_notification',
    iconColor: '#1e3a8a',
    autoCancel: true,
    extra: { taskId: task.id, date: task.date },
  };
}

export async function syncTaskNotifications(tasks: Task[]): Promise<number> {
  if (!isNativeNotificationsSupported()) return 0;

  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') return 0;

  await ensureAndroidChannel();

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((notification) => ({ id: notification.id })),
    });
  }

  const notifications = tasks
    .map((task) => {
      const at = getTaskReminderDate(task);
      if (!at) return null;
      return buildNotificationPayload(task, at);
    })
    .filter((notification): notification is NonNullable<typeof notification> => notification !== null);

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }

  return notifications.length;
}

export async function scheduleTestNotification(): Promise<void> {
  if (!isNativeNotificationsSupported()) return;

  const granted = await requestNotificationPermissions();
  if (!granted) {
    throw new Error('Notification permission was not granted.');
  }

  await ensureAndroidChannel();

  const at = new Date(Date.now() + 15_000);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 999_001,
        title: 'Planflow reminders are working',
        body: 'You will get reminders 15 minutes before timed tasks.',
        schedule: { at, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        smallIcon: 'ic_notification',
        iconColor: '#1e3a8a',
        autoCancel: true,
        extra: { test: true },
      },
    ],
  });
}

export async function cancelTaskNotification(taskId: string): Promise<void> {
  if (!isNativeNotificationsSupported()) return;

  await LocalNotifications.cancel({
    notifications: [{ id: taskIdToNotificationId(taskId) }],
  });
}

export async function getScheduledReminderCount(): Promise<number> {
  if (!isNativeNotificationsSupported()) return 0;
  const pending = await LocalNotifications.getPending();
  return pending.notifications.length;
}

export function initNotificationListeners(
  onOpenTask: (taskId: string, date?: string) => void,
): () => void {
  if (!isNativeNotificationsSupported()) {
    return () => undefined;
  }

  const actionListener = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      if (event.notification.extra?.test) return;

      const taskId = event.notification.extra?.taskId as string | undefined;
      const date = event.notification.extra?.date as string | undefined;
      if (taskId) {
        onOpenTask(taskId, date);
      }
    },
  );

  const receivedListener = LocalNotifications.addListener(
    'localNotificationReceived',
    () => undefined,
  );

  return () => {
    void actionListener.then((listener) => listener.remove());
    void receivedListener.then((listener) => listener.remove());
  };
}
