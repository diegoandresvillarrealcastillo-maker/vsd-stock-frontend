import { describe, expect, it } from 'vitest';
import { BrowserNetworkHints } from './browser-network-hints';

function setup(onLine = true) {
  const navigatorLike = { onLine };
  const events = new EventTarget();
  const hints = new BrowserNetworkHints(navigatorLike, events);
  return { navigatorLike, events, hints };
}

describe('BrowserNetworkHints', () => {
  it('reads what the browser thinks right now', () => {
    const { navigatorLike, hints } = setup(true);
    expect(hints.isOnline()).toBe(true);

    navigatorLike.onLine = false;

    expect(hints.isOnline()).toBe(false);
  });

  it('tells when the browser says the connection came back', () => {
    const { events, hints } = setup(false);
    const heard: boolean[] = [];
    hints.subscribe((online) => heard.push(online));

    events.dispatchEvent(new Event('online'));

    expect(heard).toEqual([true]);
  });

  it('tells when the browser says the connection was lost', () => {
    const { events, hints } = setup(true);
    const heard: boolean[] = [];
    hints.subscribe((online) => heard.push(online));

    events.dispatchEvent(new Event('offline'));

    expect(heard).toEqual([false]);
  });

  it('stops telling after the listener unsubscribes, for both events', () => {
    const { events, hints } = setup();
    const heard: boolean[] = [];
    const unsubscribe = hints.subscribe((online) => heard.push(online));

    unsubscribe();
    events.dispatchEvent(new Event('online'));
    events.dispatchEvent(new Event('offline'));

    expect(heard).toEqual([]);
  });

  it('keeps each listener independent', () => {
    const { events, hints } = setup();
    const first: boolean[] = [];
    const second: boolean[] = [];
    const stopFirst = hints.subscribe((online) => first.push(online));
    hints.subscribe((online) => second.push(online));

    stopFirst();
    events.dispatchEvent(new Event('offline'));

    expect(first).toEqual([]);
    expect(second).toEqual([false]);
  });
});
