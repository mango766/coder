import "@xterm/xterm/css/xterm.css";
import { type Interpolation, type Theme, useTheme } from "@emotion/react";
import { CanvasAddon } from "@xterm/addon-canvas";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import { useClipboard } from "hooks/useClipboard";
import {
	type Ref,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { cn } from "utils/cn";
import { terminalWebsocketUrl } from "utils/terminal";
import {
	ExponentialBackoff,
	type Websocket,
	WebsocketBuilder,
	WebsocketEvent,
} from "websocket-ts";
import type { ConnectionStatus } from "./types";

export type WorkspaceTerminalHandle = {
	refit: () => void;
};

type WorkspaceTerminalProps = {
	ref?: Ref<WorkspaceTerminalHandle>;
	agentId: string | undefined;
	operatingSystem?: string;
	className?: string;
	autoFocus?: boolean;
	isVisible?: boolean;
	initialCommand?: string;
	containerName?: string;
	containerUser?: string;
	onStatusChange?: (status: ConnectionStatus) => void;
	onError?: (error: Error) => void;
	reconnectionToken: string;
	baseUrl?: string;
	terminalFontFamily?: string;
	renderer?: string;
	onOpenLink?: (uri: string) => void;
	loading?: boolean;
	errorMessage?: string;
	testId?: string;
};

const DEFAULT_TERMINAL_FONT_FAMILY = "monospace";
const ESCAPED_CARRIAGE_RETURN = "\x1b\r";

const encodeTerminalPayload = (payload: Record<string, number | string>) => {
	return new TextEncoder().encode(JSON.stringify(payload));
};

export const WorkspaceTerminal = ({
	ref,
	agentId,
	operatingSystem,
	className,
	autoFocus = true,
	isVisible = true,
	initialCommand,
	containerName,
	containerUser,
	onStatusChange,
	onError,
	reconnectionToken,
	baseUrl,
	terminalFontFamily = DEFAULT_TERMINAL_FONT_FAMILY,
	renderer,
	onOpenLink,
	loading = false,
	errorMessage,
	testId,
}: WorkspaceTerminalProps) => {
	const theme = useTheme();
	const terminalBackground = theme.palette.background.default;
	const terminalWrapperRef = useRef<HTMLDivElement>(null);
	const fitAddonRef = useRef<FitAddon | undefined>(undefined);
	const websocketRef = useRef<Websocket | undefined>(undefined);
	const openLinkRef = useRef(onOpenLink);
	const [terminal, setTerminal] = useState<Terminal>();
	const { copyToClipboard } = useClipboard();

	const reportTerminalError = useCallback(
		(error: Error) => {
			console.error(error);
			onError?.(error);
		},
		[onError],
	);

	const getTerminalDimensions = useCallback(
		(terminal: Terminal): { height: number; width: number } | null => {
			if (terminal.rows <= 0 || terminal.cols <= 0) {
				reportTerminalError(
					new Error(
						`Terminal has non-positive dimensions: ${terminal.rows}x${terminal.cols}`,
					),
				);
				return null;
			}

			return {
				height: terminal.rows,
				width: terminal.cols,
			};
		},
		[reportTerminalError],
	);

	const refit = useCallback(() => {
		const fitAddon = fitAddonRef.current;
		if (!fitAddon) {
			return;
		}

		try {
			fitAddon.fit();
			fitAddon.fit();
		} catch (error) {
			// biome-ignore lint/suspicious/noConsole: Expected transient fit failure while xterm initializes.
			console.debug("Terminal fit skipped: renderer not ready", error);
		}
	}, []);

	useImperativeHandle(
		ref,
		() => ({
			refit,
		}),
		[refit],
	);

	useEffect(() => {
		openLinkRef.current = onOpenLink;
	}, [onOpenLink]);

	useEffect(() => {
		const mountNode = terminalWrapperRef.current;
		if (!mountNode) {
			const error = new Error("Terminal mount container is unavailable");
			reportTerminalError(error);
			throw error;
		}

		const nextTerminal = new Terminal({
			allowProposedApi: true,
			allowTransparency: true,
			disableStdin: false,
			fontFamily: terminalFontFamily,
			fontSize: 16,
			theme: {
				background: terminalBackground,
			},
		});

		if (renderer === "webgl") {
			nextTerminal.loadAddon(new WebglAddon());
		} else if (renderer === "canvas") {
			nextTerminal.loadAddon(new CanvasAddon());
		}

		const fitAddon = new FitAddon();
		fitAddonRef.current = fitAddon;
		nextTerminal.loadAddon(fitAddon);
		nextTerminal.loadAddon(new Unicode11Addon());
		nextTerminal.unicode.activeVersion = "11";
		nextTerminal.loadAddon(
			new WebLinksAddon((_, uri) => {
				openLinkRef.current?.(uri);
			}),
		);

		const isMac = navigator.platform.match("Mac");
		const copySelection = () => {
			const selection = nextTerminal.getSelection();
			if (selection) {
				copyToClipboard(selection);
			}
		};

		// There is no way to remove this handler, so we must attach it once and
		// rely on a ref to send it to the current socket.
		nextTerminal.attachCustomKeyEventHandler((event) => {
			// Make shift+enter send ^[^M (escaped carriage return). Applications
			// typically take this to mean to insert a literal newline.
			if (event.shiftKey && event.key === "Enter") {
				if (event.type === "keydown") {
					websocketRef.current?.send(
						encodeTerminalPayload({ data: ESCAPED_CARRIAGE_RETURN }),
					);
				}
				return false;
			}

			// Make ctrl+shift+c (command+shift+c on macOS) copy the selected text.
			// By default this usually launches the browser dev tools, but users
			// expect this keybinding to copy when in the context of the web terminal.
			if (
				(isMac ? event.metaKey : event.ctrlKey) &&
				event.shiftKey &&
				event.key === "C"
			) {
				event.preventDefault();
				if (event.type === "keydown") {
					copySelection();
				}
				return false;
			}

			return true;
		});

		// Auto-copy selection to clipboard on select.
		nextTerminal.onSelectionChange(() => {
			copySelection();
		});

		nextTerminal.open(mountNode);
		refit();

		window.addEventListener("resize", refit);

		const resizeObserver = new ResizeObserver(() => {
			refit();
		});
		resizeObserver.observe(mountNode);

		setTerminal(nextTerminal);

		return () => {
			window.removeEventListener("resize", refit);
			resizeObserver.disconnect();
			fitAddonRef.current = undefined;
			nextTerminal.dispose();
		};
	}, [
		copyToClipboard,
		refit,
		renderer,
		reportTerminalError,
		terminalBackground,
		terminalFontFamily,
	]);

	useEffect(() => {
		if (!isVisible) {
			return;
		}

		refit();
	}, [isVisible, refit]);

	useEffect(() => {
		if (!terminal || !isVisible) {
			return;
		}

		terminal.clear();
		if (autoFocus) {
			terminal.focus();
		}
		terminal.options.disableStdin = true;

		if (loading) {
			return;
		}

		if (errorMessage) {
			terminal.writeln(errorMessage);
			onStatusChange?.("disconnected");
			return;
		}

		if (!agentId) {
			const error = new Error("Terminal requires agentId to connect");
			reportTerminalError(error);
			terminal.writeln(error.message);
			onStatusChange?.("disconnected");
			return;
		}

		refit();
		const initialDimensions = getTerminalDimensions(terminal);
		if (!initialDimensions) {
			onStatusChange?.("disconnected");
			return;
		}

		let websocket: Websocket | null;
		const disposers = [
			terminal.onData((data) => {
				websocket?.send(encodeTerminalPayload({ data }));
			}),
			terminal.onResize((event) => {
				if (event.rows <= 0 || event.cols <= 0) {
					reportTerminalError(
						new Error(
							`Terminal received non-positive resize: ${event.rows}x${event.cols}`,
						),
					);
					return;
				}

				websocket?.send(
					encodeTerminalPayload({ height: event.rows, width: event.cols }),
				);
			}),
		];

		let disposed = false;
		terminalWebsocketUrl(
			baseUrl,
			reconnectionToken,
			agentId,
			initialCommand,
			initialDimensions.height,
			initialDimensions.width,
			containerName,
			containerUser,
		)
			.then((url) => {
				if (disposed) {
					return;
				}

				websocket = new WebsocketBuilder(url)
					.withBackoff(new ExponentialBackoff(1000, 6))
					.build();
				const scheduleTerminalResize = () => {
					window.setTimeout(() => {
						if (disposed) {
							return;
						}

						const dimensions = getTerminalDimensions(terminal);
						if (!dimensions) {
							terminal.options.disableStdin = true;
							onStatusChange?.("disconnected");
							return;
						}

						websocket?.send(
							encodeTerminalPayload({
								height: dimensions.height,
								width: dimensions.width,
							}),
						);
					}, 0);
				};
				websocket.binaryType = "arraybuffer";
				websocketRef.current = websocket;
				websocket.addEventListener(WebsocketEvent.open, () => {
					terminal.options = {
						disableStdin: false,
						windowsMode: operatingSystem === "windows",
					};
					refit();
					scheduleTerminalResize();
					onStatusChange?.("connected");
				});
				websocket.addEventListener(WebsocketEvent.error, (_, event) => {
					console.error("WebSocket error:", event);
					terminal.options.disableStdin = true;
					onStatusChange?.("disconnected");
				});
				websocket.addEventListener(WebsocketEvent.close, () => {
					terminal.options.disableStdin = true;
					onStatusChange?.("disconnected");
				});
				websocket.addEventListener(WebsocketEvent.message, (_, event) => {
					if (typeof event.data === "string") {
						// This exclusively occurs when testing.
						// "jest-websocket-mock" doesn't support ArrayBuffer.
						terminal.write(event.data);
					} else {
						terminal.write(new Uint8Array(event.data));
					}
				});
				websocket.addEventListener(WebsocketEvent.reconnect, () => {
					if (!websocket) {
						return;
					}

					websocket.binaryType = "arraybuffer";
					refit();
					const dimensions = getTerminalDimensions(terminal);
					if (!dimensions) {
						terminal.options.disableStdin = true;
						onStatusChange?.("disconnected");
						return;
					}
					websocket.send(
						encodeTerminalPayload({
							height: dimensions.height,
							width: dimensions.width,
						}),
					);
				});
			})
			.catch((error) => {
				if (disposed) {
					return;
				}
				console.error("WebSocket connection failed:", error);
				reportTerminalError(
					error instanceof Error ? error : new Error(String(error)),
				);
				onStatusChange?.("disconnected");
			});

		return () => {
			disposed = true;
			for (const disposer of disposers) {
				disposer.dispose();
			}
			websocket?.close(1000);
			websocketRef.current = undefined;
		};
	}, [
		agentId,
		autoFocus,
		baseUrl,
		containerName,
		containerUser,
		errorMessage,
		getTerminalDimensions,
		initialCommand,
		isVisible,
		loading,
		operatingSystem,
		reconnectionToken,
		refit,
		reportTerminalError,
		terminal,
		onStatusChange,
	]);

	return (
		<div
			className={cn("h-full w-full", className)}
			css={styles.terminal}
			ref={terminalWrapperRef}
			data-testid={testId}
		/>
	);
};

const styles = {
	terminal: (theme) => ({
		width: "100%",
		height: "100%",
		flex: 1,
		minHeight: 0,
		overflow: "hidden",
		backgroundColor: theme.palette.background.paper,
		"& .xterm": {
			padding: 4,
			width: "100%",
			height: "100%",
		},
		"& .xterm-viewport": {
			// This is required to force full-width on the terminal.
			// Otherwise there's a small white bar to the right of the scrollbar.
			width: "auto !important",
		},
		"& .xterm-viewport::-webkit-scrollbar": {
			width: "10px",
		},
		"& .xterm-viewport::-webkit-scrollbar-track": {
			backgroundColor: "inherit",
		},
		"& .xterm-viewport::-webkit-scrollbar-thumb": {
			minHeight: 20,
			backgroundColor: "rgba(255, 255, 255, 0.18)",
		},
	}),
} satisfies Record<string, Interpolation<Theme>>;
