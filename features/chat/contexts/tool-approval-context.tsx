'use client';

import { createContext, useContext } from 'react';

export type ToolApprovalFn = (params: { id: string; approved: boolean; reason?: string }) => void;

const ToolApprovalContext = createContext<ToolApprovalFn | null>(null);

export const ToolApprovalProvider = ToolApprovalContext.Provider;

export const useToolApproval = () => useContext(ToolApprovalContext);
