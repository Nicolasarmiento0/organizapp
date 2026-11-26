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
