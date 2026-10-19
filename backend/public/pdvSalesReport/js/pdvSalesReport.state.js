import { DEFAULT_TAB } from './pdvSalesReport.config.js';

const state = {
  reportData: null,
  currentTab: DEFAULT_TAB
};

export const getReportData = () => state.reportData;
export const setReportData = (data) => { state.reportData = data; };
export const getCurrentTab = () => state.currentTab;
export const setCurrentTab = (tab) => { state.currentTab = tab; };
