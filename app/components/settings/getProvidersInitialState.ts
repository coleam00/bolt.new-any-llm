import Cookies from 'js-cookie';

export function getProvidersInitialState(providersList: { name: string }[]) {
  return () => {
    const savedProviders = Cookies.get('providers');
    let parsedProviders = {};

    if (savedProviders) {
      try {
        parsedProviders = JSON.parse(savedProviders);
      } catch (error) {
        console.error('Failed to parse providers from cookies:', error);
      }
    }

    return providersList.map((provider) => ({
      ...provider,
      isEnabled: parsedProviders.hasOwnProperty(provider.name) ? parsedProviders.hasOwnProperty[provider.name] : true,
    }));
  };
}
