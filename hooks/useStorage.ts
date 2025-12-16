import { useState, useEffect } from 'react';
import { AppData } from '../types';
import { getStorageData, saveStorageData } from '../utils';

export const useStorage = () => {
  const [data, setData] = useState<AppData>({
    projects: [],
    templates: [],
    lightGroups: []
  });

  const load = () => {
    const storedData = getStorageData();
    setData(storedData);
  };

  useEffect(() => {
    load();
  }, []);

  const save = (newData: AppData) => {
    saveStorageData(newData);
    setData(newData); // Update local state to reflect changes immediately
  };

  return { data, load, save };
};
