import 'dotenv/config';

export default {
  expo: {
    name: 'WearAware',
    slug: 'wearaware',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.wearaware.app',
      infoPlist: {
        NSCameraUsageDescription:
          'WearAware needs camera access to scan clothing care labels.',
        NSLocationWhenInUseUsageDescription:
          'WearAware needs your location to find nearby charity shops.',
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      package: 'com.wearaware.app',
      permissions: [
        'CAMERA',
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
    plugins: [
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow WearAware to access your camera to scan clothing labels.',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow WearAware to use your location to find nearby charity shops.',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'f8a6bb78-d9d7-41c7-bdba-9335542d817f',
      },
    },
  },
};
