import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary, { registerGlobalErrorHandlers } from './src/components/ErrorBoundary';

registerGlobalErrorHandlers();

export default function App() {
  return (
    <ErrorBoundary>
      <AppNavigator />
    </ErrorBoundary>
  );
}
