import { ModelExecutionConfig } from "@/types/execution";

const KIE_API_BASE = 'https://api.kie.ai/api/v1';

/**
 * Kie.ai Service
 * Handles interaction with the Kie.ai unified API
 */
export const KieService = {
    /**
     * Create a generation task
     */
    async createTask(
        modelId: string,
        input: Record<string, any>,
        apiKey: string
    ): Promise<{ taskId: string }> {
        try {
            // Basic body structure for Kie
            const payload = {
                model: modelId,
                input: input,
                // Optional: callBackUrl can be added here if we had a webhook handler
            };

            const response = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let errorMsg = response.statusText;
                try {
                    const errData = await response.json();
                    errorMsg = errData.msg || errData.error || errorMsg;
                } catch (e) { /* ignore */ }
                throw new Error(`Kie API Error (${response.status}): ${errorMsg}`);
            }

            const data = await response.json();

            // Check internal code
            if (data.code !== 200) {
                throw new Error(`Kie API Error: ${data.msg || 'Unknown error'}`);
            }

            return { taskId: data.data.taskId };
        } catch (error) {
            console.error('Kie createTask failed:', error);
            throw error;
        }
    },

    /**
     * Poll for task status (image tasks — /jobs/recordInfo)
     */
    async getTaskStatus(taskId: string, apiKey: string): Promise<any> {
        const url = `${KIE_API_BASE}/jobs/recordInfo?taskId=${taskId}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to check task status: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    },

    /**
     * Poll for Veo task status (video tasks — /veo/record-info)
     * Uses successFlag: 0=processing, 1=success, 2=failed, 3=generation failed
     * Video URLs are in data.resultUrls (JSON string)
     */
    async getVeoTaskStatus(taskId: string, apiKey: string): Promise<{
        code: number;
        msg: string;
        data: {
            successFlag: number;
            resultUrls?: string;
            taskId: string;
            [key: string]: unknown;
        } | null;
    }> {
        const url = `${KIE_API_BASE}/veo/record-info?taskId=${taskId}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to check Veo task status: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    },

    /**
     * Wait for a task to complete (simple polling)
     */
    async waitForTaskCompletion(taskId: string, apiKey: string, intervalMs = 2000, timeoutMs = 60000): Promise<any> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const statusData = await this.getTaskStatus(taskId, apiKey);

            // Check status field - Kie docs imply we check the data
            // Based on docs, successful response has data.status usually
            // If the docs don't specify exact status strings, we assume standard async patterns.
            // However, usually these platforms return 'status': 'SUCCEEDED' | 'FAILED' | 'PENDING'
            // Let's inspect the typical response structure from the docs provided? 
            // Docs only showed create task and recordInfo endpoints but not the exact recordInfo response body for status.
            // We will assume a standard wrapper.
            // Let's try to map typical fields.

            if (statusData.code !== 200) {
                throw new Error(`Task check failed: ${statusData.msg}`);
            }

            const taskInfo = statusData.data;

            // Common status fields: state (Kie docs: waiting, success, fail)
            const status = taskInfo.state || taskInfo.status;

            if (status === 'success' || status === 'SUCCEEDED' || status === 'SUCCESS' || status === 1) {
                return taskInfo;
            }

            if (status === 'fail' || status === 'FAILED' || status === 'FAILURE' || status === 2) {
                throw new Error(`Task failed: ${taskInfo.failMsg || taskInfo.failureReason || 'Unknown reason'}`);
            }

            // Wait
            await new Promise(r => setTimeout(r, intervalMs));
        }

        throw new Error("Task timed out");
    },

    /**
     * Create a Veo 3.1 video generation task
     * Uses the dedicated /veo/generate endpoint (flat payload, no input wrapper)
     */
    async createVeoTask(
        params: {
            prompt: string;
            model?: 'veo3' | 'veo3_fast';
            imageUrls?: string[];
            generationType?: 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO';
            aspectRatio?: '16:9' | '9:16' | 'Auto';
            seeds?: number;
        },
        apiKey: string
    ): Promise<{ taskId: string }> {
        try {
            const payload: Record<string, unknown> = {
                prompt: params.prompt,
                model: params.model ?? 'veo3_fast',
                aspect_ratio: params.aspectRatio ?? '16:9',
            };

            if (params.imageUrls && params.imageUrls.length > 0) {
                payload.imageUrls = params.imageUrls;
            }
            if (params.generationType) {
                payload.generationType = params.generationType;
            }
            if (params.seeds) {
                payload.seeds = params.seeds;
            }

            const response = await fetch(`${KIE_API_BASE}/veo/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let errorMsg = response.statusText;
                try {
                    const errData = await response.json();
                    errorMsg = errData.msg || errData.error || errorMsg;
                } catch (e) { /* ignore */ }
                throw new Error(`Kie Veo API Error (${response.status}): ${errorMsg}`);
            }

            const data = await response.json();

            if (data.code !== 200) {
                throw new Error(`Kie Veo API Error: ${data.msg || 'Unknown error'}`);
            }

            return { taskId: data.data.taskId };
        } catch (error) {
            console.error('Kie createVeoTask failed:', error);
            throw error;
        }
    },

    /**
     * Create a Suno music generation task
     * Uses the dedicated /generate endpoint (flat payload, no model/input wrapper)
     * Status: /generate/record-info with data.status field
     */
    async createSunoTask(
        params: {
            prompt: string;
            customMode?: boolean;
            instrumental?: boolean;
            model?: 'V3_5' | 'V4' | 'V4_5' | 'V4_5PLUS' | 'V4_5ALL' | 'V5';
            style?: string;
            title?: string;
            negativeTags?: string;
            vocalGender?: 'm' | 'f';
            styleWeight?: number;
            weirdnessConstraint?: number;
            audioWeight?: number;
        },
        apiKey: string
    ): Promise<{ taskId: string }> {
        try {
            const payload: Record<string, unknown> = {
                prompt: params.prompt,
                customMode: params.customMode ?? false,
                instrumental: params.instrumental ?? false,
                model: params.model ?? 'V4_5',
            };

            if (params.customMode) {
                if (params.style) payload.style = params.style;
                if (params.title) payload.title = params.title;
            }
            // callBackUrl is required by the Suno API even if we poll instead of using callbacks
            payload.callBackUrl = 'https://api.kie.ai/callback/noop';
            if (params.negativeTags) payload.negativeTags = params.negativeTags;
            if (params.vocalGender) payload.vocalGender = params.vocalGender;
            if (params.styleWeight !== undefined) payload.styleWeight = params.styleWeight;
            if (params.weirdnessConstraint !== undefined) payload.weirdnessConstraint = params.weirdnessConstraint;
            if (params.audioWeight !== undefined) payload.audioWeight = params.audioWeight;

            const response = await fetch(`${KIE_API_BASE}/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let errorMsg = response.statusText;
                try {
                    const errData = await response.json();
                    errorMsg = errData.msg || errData.error || errorMsg;
                } catch (e) { /* ignore */ }
                throw new Error(`Kie Suno API Error (${response.status}): ${errorMsg}`);
            }

            const data = await response.json();

            if (data.code !== 200) {
                throw new Error(`Kie Suno API Error: ${data.msg || 'Unknown error'}`);
            }

            return { taskId: data.data.taskId };
        } catch (error) {
            console.error('Kie createSunoTask failed:', error);
            throw error;
        }
    },

    /**
     * Poll for Suno task status (audio tasks — /generate/record-info)
     * Uses data.status: 'SUCCESS' | 'FIRST_SUCCESS' | 'TEXT_SUCCESS' | 'PENDING' |
     *   'CREATE_TASK_FAILED' | 'GENERATE_AUDIO_FAILED' | 'CALLBACK_EXCEPTION' | 'SENSITIVE_WORD_ERROR'
     * Audio data is in data.response.sunoData[] with audioUrl, imageUrl, title, tags, duration
     */
    async getSunoTaskStatus(taskId: string, apiKey: string): Promise<{
        code: number;
        msg: string;
        data: {
            taskId: string;
            status: string;
            errorMessage?: string;
            response?: {
                sunoData?: Array<{
                    id: string;
                    audioUrl: string;
                    streamAudioUrl?: string;
                    imageUrl?: string;
                    prompt: string;
                    title: string;
                    tags: string;
                    duration: number;
                    createTime: string;
                }>;
            };
        } | null;
    }> {
        const url = `${KIE_API_BASE}/generate/record-info?taskId=${taskId}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to check Suno task status: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    },

    /**
     * Create an ElevenLabs TTS task (single-voice text-to-speech)
     * Uses the standard /jobs/createTask endpoint
     * Status: /jobs/recordInfo with data.state field
     * Output: resultJson → resultUrls[] (MP3 URLs)
     */
    async createTtsTask(
        params: {
            text: string;
            voice?: string;
            stability?: number;
            similarityBoost?: number;
            style?: number;
            speed?: number;
        },
        apiKey: string
    ): Promise<{ taskId: string }> {
        const input: Record<string, unknown> = {
            text: params.text,
            voice: params.voice || 'BIvP0GN1cAtSRTxNHnWS', // Default: Ellen
        };

        if (params.stability !== undefined) input.stability = params.stability;
        if (params.similarityBoost !== undefined) input.similarity_boost = params.similarityBoost;
        if (params.style !== undefined) input.style = params.style;
        if (params.speed !== undefined) input.speed = params.speed;
        // Note: language_code is NOT supported by multilingual-v2 (only Turbo v2.5 / Flash v2.5)

        return this.createTask('elevenlabs/text-to-speech-multilingual-v2', input, apiKey);
    },

    /**
     * Create an ElevenLabs Dialogue task (multi-speaker)
     * Uses the standard /jobs/createTask endpoint
     * Status: /jobs/recordInfo with data.state field
     * Output: resultJson → resultUrls[] (MP3 URLs)
     */
    async createDialogueTask(
        params: {
            dialogue: Array<{ text: string; voice: string }>;
            stability?: number;
            languageCode?: string;
        },
        apiKey: string
    ): Promise<{ taskId: string }> {
        const input: Record<string, unknown> = {
            dialogue: params.dialogue,
        };

        if (params.stability !== undefined) input.stability = params.stability;
        if (params.languageCode) input.language_code = params.languageCode;

        return this.createTask('elevenlabs/text-to-dialogue-v3', input, apiKey);
    },

    /**
     * Get User Credits
     */
    async getUserCredits(apiKey: string): Promise<{ total: number, used: number, remaining: number } | null> {
        try {
            // Updated per OpenAPI spec: /api/v1/chat/credit
            const response = await fetch(`${KIE_API_BASE}/chat/credit`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                }
            });

            if (!response.ok) return null;

            const data = await response.json();
            if (data.code === 200 && typeof data.data === 'number') {
                // API returns just the remaining credits as an integer in 'data'
                return {
                    total: 0, // Not provided by this endpoint
                    used: 0,  // Not provided by this endpoint
                    remaining: data.data
                };
            }
            return null;

        } catch (e) {
            console.error("Failed to fetch credits:", e);
            return null;
        }
    }
};
