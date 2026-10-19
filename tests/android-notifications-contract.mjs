import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pluginManifest = await readFile(new URL('../node_modules/@capacitor/local-notifications/android/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const pluginManager = await readFile(new URL('../node_modules/@capacitor/local-notifications/android/src/main/java/com/capacitorjs/plugins/localnotifications/LocalNotificationManager.java', import.meta.url), 'utf8');
const publisher = await readFile(new URL('../node_modules/@capacitor/local-notifications/android/src/main/java/com/capacitorjs/plugins/localnotifications/TimedNotificationPublisher.java', import.meta.url), 'utf8');
const restoreReceiver = await readFile(new URL('../node_modules/@capacitor/local-notifications/android/src/main/java/com/capacitorjs/plugins/localnotifications/LocalNotificationRestoreReceiver.java', import.meta.url), 'utf8');
const notifications = await readFile(new URL('../v2/notifications.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../v2/app.js', import.meta.url), 'utf8');

assert.match(pluginManifest, /android\.permission\.POST_NOTIFICATIONS/, 'plugin manifest declares Android 13 notification permission');
assert.match(pluginManifest, /android\.permission\.RECEIVE_BOOT_COMPLETED/, 'plugin manifest requests reboot restoration');
assert.match(pluginManifest, /LocalNotificationRestoreReceiver/, 'plugin registers its alarm restore receiver');
assert.match(pluginManifest, /android\.intent\.action\.BOOT_COMPLETED/, 'restore receiver handles normal device boot');
assert.match(pluginManifest, /android\.intent\.action\.LOCKED_BOOT_COMPLETED/, 'restore receiver handles locked boot broadcasts');
assert.match(pluginManager, /setExactAndAllowWhileIdle\(AlarmManager\.RTC_WAKEUP/, 'exact notifications can wake the device while idle');
assert.match(pluginManager, /cancelTimerForNotification\(id\)/, 'rescheduling an occurrence cancels its previous alarm by stable notification ID');
assert.match(publisher, /notificationManager\.notify\(id, notification\)/, 'Android alarm receiver posts the notification when its alarm fires');
assert.match(restoreReceiver, /localNotificationManager\.schedule\(null, notifications\)/, 'saved notifications are rescheduled on device reboot');
assert.match(notifications, /allowWhileIdle: true/, 'app marks local alarms as Doze capable');
assert.match(notifications, /exact\.exact_alarm !== 'granted'\) return \{ status: 'exact-alarm-permission-required'/, 'app refuses to report alarms scheduled when exact access is missing');
assert.match(app, /changeExactNotificationSetting\(\)/, 'app sends the user to Android exact alarm access settings');
assert.match(notifications, /requestPermissions\(\)/, 'notification scheduler requests runtime notification permissions through Capacitor');
assert.match(app, /syncTodoNotifications\(\{guidePermissions:true\}\)/, 'creating a reminder starts the permission guidance flow');
assert.match(notifications, /applyReminderToSeries|reminderSeriesKey/);

console.log('Android notification contract checks passed (manifest merge contract, exact/idle alarm implementation, reboot restore receiver, and app permission flow). Runtime delivery still requires an Android device/emulator test.');
