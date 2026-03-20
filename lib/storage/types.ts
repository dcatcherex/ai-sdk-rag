export interface BucketConfig {
    name: string;
    public: boolean;
    maxSize: number;
    allowedTypes: string[];
    allowedExtensions?: string[];
}
