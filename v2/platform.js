import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const NativeSpeechRecognition = registerPlugin('NativeSpeechRecognition');
export { Capacitor, Preferences, LocalNotifications, Filesystem, Directory, Share, NativeBiometric, NativeSpeechRecognition };
