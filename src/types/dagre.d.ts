declare module "dagre" {
  const dagre: {
    graphlib: {
      Graph: new (opts?: { multigraph?: boolean; compound?: boolean; directed?: boolean }) => {
        setGraph(opts: Record<string, unknown>): void;
        setDefaultEdgeLabel(fn: () => Record<string, unknown>): void;
        setNode(id: string, opts: Record<string, unknown>): void;
        setEdge(from: string, to: string, opts?: Record<string, unknown>): void;
        nodes(): string[];
        edges(): { v: string; w: string }[];
        node(id: string): { x: number; y: number; width: number; height: number };
      };
    };
    layout(graph: unknown): void;
  };
  export default dagre;
}
