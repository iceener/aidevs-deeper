
export interface Tool {
    name: string;
    description: string;
    handler: (messages: CoreMessage[], task: TaskWithRelations) => Promise<string>;
}