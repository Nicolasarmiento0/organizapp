import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const REMINDER_CHANNEL_ID = 'organiza-reminders';

/**
 * Configura el manejador de notificaciones en primer plano (100% Gratuito via expo-notifications)
 */
export function configureLocalNotifications(): void {
  if (Platform.OS === 'web') {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Recordatorios & Cockpit Hoy',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#3E6AE1',
    });
  }
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return Boolean(
    requested.granted ||
      requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export interface ScheduleReminderOptions {
  taskId: string;
  title: string;
  notes?: string | null;
  reminderAtMs: number;
}

/**
 * Programa un recordatorio local nativo sin requerir servidores push de pago ($0 USD).
 */
export async function scheduleTaskReminderNotification(
  options: ScheduleReminderOptions
): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const now = Date.now();
  if (options.reminderAtMs <= now + 5000) {
    return null;
  }

  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) {
    return null;
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Recordatorio • Organiza',
        body: options.title,
        subtitle: options.notes || undefined,
        data: { taskId: options.taskId },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(options.reminderAtMs),
      },
    });
    return notificationId;
  } catch {
    return null;
  }
}

export async function cancelTaskReminderNotification(
  notificationId?: string | null
): Promise<void> {
  if (!notificationId || Platform.OS === 'web') {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Ignorar si la notificación ya fue disparada o eliminada por el sistema
  }
}

export interface ScheduleWorkBlockNotificationOptions {
  blockId: string;
  title: string;
  dateKey: string;
  startTime: string;
  alertMinutesBefore: 0 | 15 | 60;
  locationOrLink?: string | null;
}

/**
 * Programa una notificación local escalonada ($0 USD via expo-notifications)
 * para eventos o turnos de trabajo: "A la hora", "15 min antes" o "1 hora antes".
 */
export async function scheduleWorkBlockNotification(
  options: ScheduleWorkBlockNotificationOptions
): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const [yStr, mStr, dStr] = options.dateKey.split('-');
  const [hStr, minStr] = options.startTime.split(':');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const hours = Number(hStr);
  const minutes = Number(minStr);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  const eventDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const triggerAtMs = eventDate.getTime() - options.alertMinutesBefore * 60_000;

  if (triggerAtMs <= Date.now() + 5000) {
    return null;
  }

  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) {
    return null;
  }

  const prefix =
    options.alertMinutesBefore === 0
      ? 'Ahora'
      : options.alertMinutesBefore === 15
        ? 'En 15 min'
        : 'En 1 hora';

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${prefix} • Organiza`,
        body: options.title,
        subtitle: options.locationOrLink || `Inicio ${options.startTime}`,
        data: { blockId: options.blockId },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerAtMs),
      },
    });
    return notificationId;
  } catch {
    return null;
  }
}

export const cancelWorkBlockNotification = cancelTaskReminderNotification;
