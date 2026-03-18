import { deploymentConfig } from "api/queries/deployment";
import { appearanceSettings } from "api/queries/users";
import type * as TypesGen from "api/typesGenerated";
import { useProxy } from "contexts/ProxyContext";
import { useEmbeddedMetadata } from "hooks/useEmbeddedMetadata";
import type { ConnectionStatus } from "modules/terminal/types";
import {
	WorkspaceTerminal,
	type WorkspaceTerminalHandle,
} from "modules/terminal/WorkspaceTerminal";
import { WorkspaceTerminalAlerts } from "modules/terminal/WorkspaceTerminalAlerts";
import { type FC, useCallback, useRef, useState } from "react";
import { useQuery } from "react-query";
import { DEFAULT_TERMINAL_FONT, terminalFonts } from "theme/constants";

interface TerminalPanelProps {
	workspaceAgent: TypesGen.WorkspaceAgent | undefined;
}

export const TerminalPanel: FC<TerminalPanelProps> = ({ workspaceAgent }) => {
	const { proxy } = useProxy();
	const { metadata } = useEmbeddedMetadata();
	const terminalRef = useRef<WorkspaceTerminalHandle>(null);
	const reconnectionTokenRef = useRef<string>(crypto.randomUUID());
	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("initializing");
	const config = useQuery(deploymentConfig());
	const appearanceSettingsQuery = useQuery(
		appearanceSettings(metadata.userAppearance),
	);
	const renderer = config.data?.config.web_terminal_renderer;
	const terminalBaseUrl =
		process.env.NODE_ENV !== "development"
			? proxy.preferredPathAppURL
			: undefined;
	const currentTerminalFont =
		appearanceSettingsQuery.data?.terminal_font || DEFAULT_TERMINAL_FONT;

	const handleTerminalError = useCallback((error: Error) => {
		console.error("WebSocket failed:", error);
	}, []);

	const handleAlertChange = useCallback(() => {
		terminalRef.current?.refit();
	}, []);

	if (!workspaceAgent) {
		return (
			<div className="flex h-full min-h-0 flex-col">
				<div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-xs text-content-secondary">
					Terminal will be available once the workspace agent is ready.
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<WorkspaceTerminalAlerts
				agent={workspaceAgent}
				status={connectionStatus}
				onAlertChange={handleAlertChange}
			/>
			<div className="min-h-0 flex-1">
				<WorkspaceTerminal
					ref={terminalRef}
					agentId={workspaceAgent.id}
					operatingSystem={workspaceAgent.operating_system}
					autoFocus={false}
					onStatusChange={setConnectionStatus}
					onError={handleTerminalError}
					reconnectionToken={reconnectionTokenRef.current}
					baseUrl={terminalBaseUrl}
					terminalFontFamily={terminalFonts[currentTerminalFont]}
					renderer={renderer}
					loading={config.isLoading || appearanceSettingsQuery.isLoading}
					testId="agents-sidebar-terminal"
				/>
			</div>
		</div>
	);
};
