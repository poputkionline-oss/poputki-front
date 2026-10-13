export function requestCoordinates({ automatic = false, win = window, nav = navigator } = {}) {
  const tg = win.Telegram?.WebApp;
  const manager = tg?.initData && tg?.LocationManager;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject({ code: 3 }), 15000);
    const succeed = location => { clearTimeout(timer); resolve(location); };
    const fail = error => { clearTimeout(timer); reject(error); };
    if (manager) {
      const run = () => {
        if (!manager.isLocationAvailable) return fail({ code: 2 });
        // Telegram requires an interface action for first access. Never prompt on mount.
        if (automatic && !manager.isAccessGranted) return fail({ code: 'ACTION_REQUIRED' });
        manager.getLocation(location => location
          ? succeed({ latitude: location.latitude, longitude: location.longitude,
              accuracy: location.horizontal_accuracy })
          : fail({ code: 1 }));
      };
      try { manager.isInited ? run() : manager.init(run); } catch { fail({ code: 2 }); }
    } else if (nav.geolocation) {
      nav.geolocation.getCurrentPosition(position => succeed(position.coords), fail,
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
    } else { fail({ code: 2 }); }
  });
}

export function locationErrorMessage(error) {
  if (error?.code === 1) return 'Доступ к геолокации запрещён. Разрешите его в настройках или выберите город вручную.';
  if (error?.code === 'ACTION_REQUIRED') return 'Нажмите «Определить мой город», чтобы разрешить геолокацию.';
  return 'Не удалось определить город. Выберите его вручную или попробуйте ещё раз.';
}
