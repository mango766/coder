import { Badge } from "components/Badge/Badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "components/Tooltip/Tooltip";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { FC } from "react";
import { cn } from "utils/cn";
import { formatDate } from "utils/time";
import { AIBridgeModelIcon } from "../RequestLogsPage/icons/AIBridgeModelIcon";
import {
	prettyFormatJSON,
	roundTokenDisplay,
	roundDurationDisplay,
} from "../utils";
import { CopyButton } from "components/CopyButton/CopyButton";

interface TokenBadgesProps {
	size?: "xs" | "sm" | "md";
	inputTokens: number;
	outputTokens: number;
	tokenUsageMetadata?: Record<string, unknown>;
}

export const TokenBadges: FC<TokenBadgesProps> = ({
	size = "sm",
	inputTokens,
	outputTokens,
	tokenUsageMetadata,
}) => (
	<div className="flex items-center whitespace-nowrap">
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span>
						<Badge className="gap-0 rounded-e-none" size={size}>
							<ArrowDownIcon className="size-icon-lg flex-shrink-0" />
							<span className="truncate min-w-0">
								{roundTokenDisplay(inputTokens)}
							</span>
						</Badge>
						<Badge
							className="gap-0 bg-surface-tertiary rounded-s-none"
							size={size}
						>
							<ArrowUpIcon className="size-icon-lg flex-shrink-0" />
							<span className="truncate min-w-0">
								{roundTokenDisplay(outputTokens)}
							</span>
						</Badge>
					</span>
				</TooltipTrigger>
				<TooltipContent>
					<div className="grid grid-cols-2 gap-8">
						<div>
							<div className="flex items-center gap-1">
								<ArrowDownIcon className="size-icon-sm flex-shrink-0" />
								<span className="text-content-primary text-sm">
									Input tokens
								</span>
							</div>
							<div className="flex items-center justify-between gap-4">
								<div className="text-xs text-content-secondary">Input</div>
								<div className="text-xs text-content-secondary">
									{roundTokenDisplay(inputTokens)}
								</div>
							</div>
						</div>

						<div>
							<div className="flex items-center gap-1">
								<ArrowUpIcon className="size-icon-sm flex-shrink-0" />
								<span className="text-content-primary text-sm">
									Output tokens
								</span>
							</div>
							<div className="flex items-center justify-between gap-4">
								<div className="text-xs text-content-secondary">Output</div>
								<div className="text-xs text-content-secondary">
									{roundTokenDisplay(outputTokens)}
								</div>
							</div>
						</div>
					</div>
					{tokenUsageMetadata && (
						<>
							<div className="text-content-primary text-sm mt-4">
								Token usage metadata
							</div>
							<pre className="mt-2 p-4 bg-surface-secondary rounded text-xs overflow-x-auto">
								{prettyFormatJSON(JSON.stringify(tokenUsageMetadata))}
							</pre>
						</>
					)}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	</div>
);

interface PromptDetailsTableProps {
	timestamp: Date;
	model: string;
	inputTokens: number;
	outputTokens: number;
	tokenUsageMetadata?: Record<string, unknown>;
	className?: string;
}

export const PromptDetailsTable: FC<PromptDetailsTableProps> = ({
	timestamp,
	model,
	inputTokens,
	outputTokens,
	tokenUsageMetadata,
	className,
}) => {
	return (
		<div className={cn(className, "text-sm text-content-secondary")}>
			<div className="flex items-center justify-between mb-2">
				<span className="pr-4">Timestamp</span>
				<span
					className="font-mono whitespace-nowrap truncate"
					title={formatDate(timestamp)}
				>
					{formatDate(timestamp)}
				</span>
			</div>
			<div className="flex items-center justify-between mb-2">
				<span className="pr-4">Model</span>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge className="gap-1.5">
								<AIBridgeModelIcon model={model} className="size-icon-xs" />
								<span className="truncate min-w-0">{model}</span>
							</Badge>
						</TooltipTrigger>
						<TooltipContent>{model}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
			<div className="flex items-center justify-between">
				<span className="pr-4">In / out tokens</span>
				<TokenBadges
					inputTokens={inputTokens}
					outputTokens={outputTokens}
					tokenUsageMetadata={tokenUsageMetadata}
				/>
			</div>
		</div>
	);
};

interface AgenticLoopDetailsTableProps {
	duration: number; // in seconds
	toolCalls: number;
	inputTokens: number;
	outputTokens: number;
	className?: string;
}

export const AgenticLoopDetailsTable: FC<AgenticLoopDetailsTableProps> = ({
	duration,
	toolCalls,
	inputTokens,
	outputTokens,
	className,
}) => {
	return (
		<div className={cn(className, "text-sm text-content-secondary")}>
			<div className="flex items-center justify-between">
				<span className="pr-4">In / out tokens</span>
				<TokenBadges inputTokens={inputTokens} outputTokens={outputTokens} />
			</div>
			<div className="flex items-center justify-between my-2">
				<span className="pr-4">Tool calls</span>
				<span>{toolCalls}</span>
			</div>
			<div className="flex items-center justify-between">
				<span className="pr-4">Duration</span>
				<span title={`${duration}ms`}>{roundDurationDisplay(duration)}</span>
			</div>
		</div>
	);
};

interface ToolCallDetailsTableProps {
	timestamp: Date;
	serverURL: string;
	inputTokens: number;
	outputTokens: number;
	tokenUsageMetadata?: Record<string, unknown>;
	className?: string;
}

export const ToolCallDetailsTable: FC<ToolCallDetailsTableProps> = ({
	timestamp,
	serverURL,
	inputTokens,
	outputTokens,
	tokenUsageMetadata,
	className,
}) => {
	return (
		<div
			className={cn(
				className,
				"flex flex-col gap-2 text-xs text-content-secondary",
			)}
		>
			<div className="flex items-center justify-between whitespace-nowrap">
				<span className="pr-4">In / out tokens</span>
				<TokenBadges
					inputTokens={inputTokens}
					outputTokens={outputTokens}
					tokenUsageMetadata={tokenUsageMetadata}
				/>
			</div>
			<div className="flex items-center justify-between">
				<span className="pr-4">Started at</span>
				<span
					className="font-mono whitespace-nowrap truncate"
					title={formatDate(timestamp)}
				>
					{formatDate(timestamp)}
				</span>
			</div>
			<div className="flex items-center justify-between">
				<span className="pr-4">MCP server</span>
				<span className="font-mono truncate">{serverURL}</span>
				<CopyButton text={serverURL} label="Copy MCP server URL" />
			</div>
		</div>
	);
};
