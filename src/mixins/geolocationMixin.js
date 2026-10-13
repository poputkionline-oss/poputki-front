import { requestCoordinates, locationErrorMessage } from '../services/geolocationService';

export default {
  data() { return { geoLoading: false, geoMessage: '', geoRevision: 0, geoAlive: true }; },
  beforeUnmount() { this.geoAlive = false; },
  methods: {
    markOriginChanged() { this.geoRevision++; this.geoMessage = ''; },
    async detectMyCity(automatic = false) {
      if (!this.geoAlive || this.geoLoading || !this.availableCities.length || (automatic && this.fromCity)) return false;
      if (automatic) {
        // Once per tab session: permission refusal must not cause repeated prompts.
        try {
          if (sessionStorage.getItem('poputki.geo.attempted')) return false;
          sessionStorage.setItem('poputki.geo.attempted', '1');
        } catch { return false; }
      }
      const revision = this.geoRevision;
      const origin = this.fromCity;
      const tab = this.activeTab;
      this.geoLoading = true;
      this.geoMessage = 'Определяем город…';
      try {
        const coordinates = await requestCoordinates({ automatic });
        const { resolveGeoCity } = await import('../utils/geoCityResolver.js');
        const city = resolveGeoCity(coordinates.latitude, coordinates.longitude,
          this.availableCities, coordinates.accuracy);
        if (!this.geoAlive || revision !== this.geoRevision || origin !== this.fromCity || tab !== this.activeTab) return false;
        if (!city) {
          this.geoMessage = 'Город рядом с Вами отсутствует в списке отправления. Выберите город вручную.';
          return false;
        }
        this.fromCity = city;
        this.geoMessage = `Ближайший город отправления: ${city}. Вы можете его изменить.`;
        return true;
      } catch (error) {
        if (this.geoAlive && revision === this.geoRevision && origin === this.fromCity && tab === this.activeTab)
          this.geoMessage = locationErrorMessage(error);
        return false;
      } finally { if (this.geoAlive) this.geoLoading = false; }
    }
  }
};
