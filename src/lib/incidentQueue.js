import AsyncStorage from '@react-native-async-storage/async-storage';

const INCIDENT_QUEUE_KEY = 'incident_queue_v1';

const parseQueue = (raw) => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse incident queue:', error);
    return [];
  }
};

const writeQueue = async (queue) => {
  await AsyncStorage.setItem(INCIDENT_QUEUE_KEY, JSON.stringify(queue));
};

export const getIncidentQueue = async () => {
  const raw = await AsyncStorage.getItem(INCIDENT_QUEUE_KEY);
  return parseQueue(raw);
};

export const enqueueIncident = async (item) => {
  const current = await getIncidentQueue();
  const next = [...current, item];
  await writeQueue(next);
  return next;
};

export const removeIncidentByLocalIds = async (localIds) => {
  if (!localIds?.length) {
    return getIncidentQueue();
  }
  const idSet = new Set(localIds);
  const current = await getIncidentQueue();
  const next = current.filter((item) => !idSet.has(item.local_id));
  await writeQueue(next);
  return next;
};

