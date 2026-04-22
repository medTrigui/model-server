# Model Server Flowcharts

This document provides visual explanations of the architecture, recent reliability work, and impact from the change log.

## How to Read These Diagrams

- Business-oriented diagrams focus on user outcomes, risk reduction, and operational confidence.
- Engineering-oriented diagrams focus on runtime data flow, validation, state transitions, and subscriptions.
- All diagrams map directly to the work summarized in CHANGES.md.

---

## 1) Executive Change Story (Business + Engineering)

```mermaid
flowchart LR
    A[Incident Risk in Legacy Flow] --> B[Analyze Production + Dev Behavior]
    B --> C[Prioritize High-Severity Fixes]
    C --> D[Implement + Validate]
    D --> E[Safer Real-Time Guidance]
    E --> F[Higher Operator Trust]

    C --> C1[WebSocket Route Alignment]
    C --> C2[Partial Update Integrity]
    C --> C3[Sensor Input Validation]
    C --> C4[Configurable Danger Threshold]
    C --> C5[Mutation Test Coverage]
    C --> C6[Dependency Remediation Plan]

    classDef risk fill:#ffe6e6,stroke:#d62828,stroke-width:2px,color:#3d0000;
    classDef action fill:#fff3cd,stroke:#e09f3e,stroke-width:2px,color:#4a2c00;
    classDef build fill:#e8f7ff,stroke:#118ab2,stroke-width:2px,color:#012a4a;
    classDef outcome fill:#e7f9ed,stroke:#2a9d8f,stroke-width:2px,color:#0b3d2e;

    class A risk;
    class B,C action;
    class D,C1,C2,C3,C4,C5,C6 build;
    class E,F outcome;
```

---

## 2) Runtime System Architecture and Data Flow

```mermaid
flowchart TB
    subgraph FE[Frontend Layer]
      FE1[React App]
      FE2[DeviceMonitor Cards]
      FE3[Apollo HTTP Link]
      FE4[Apollo GraphQL WS Link]
    end

    subgraph EDGE[Routing and Edge]
      R1[/graphql HTTP Route]
      R2[/graphqlws WebSocket Route]
      R3[Dev Proxy + NGINX Proxy]
    end

    subgraph BE[Backend Layer]
      B1[GraphQL Schema]
      B2[Mutation Resolvers]
      B3[Query Resolvers]
      B4[Subscription Resolvers]
      B5[PubSub Cache per Device]
    end

    subgraph MODEL[State and Safety Engine]
      M1[Device State Objects]
      M2[deferredEval]
      M3[validateSensorsInput]
      M4[evalDanger using TEMP_DANGER_THRESHOLD]
      M5[updateGraph Evacuation Mapping]
      M6[Event Emitters deviceChanged + ledStateChanged]
    end

    FE1 --> FE2
    FE1 --> FE3 --> R1
    FE1 --> FE4 --> R2
    R1 <--> R3
    R2 <--> R3

    R1 --> B1 --> B3 --> M1
    R1 --> B1 --> B2 --> M3 --> M2 --> M4 --> M5 --> M6
    M6 --> B5 --> B4 --> R2 --> FE4 --> FE2

    classDef frontend fill:#e8f1ff,stroke:#4361ee,stroke-width:2px,color:#14213d;
    classDef edge fill:#fff4e6,stroke:#f77f00,stroke-width:2px,color:#5a3d00;
    classDef backend fill:#f1f8e9,stroke:#2a9d8f,stroke-width:2px,color:#0b3d2e;
    classDef model fill:#fef6ff,stroke:#b5179e,stroke-width:2px,color:#4a154b;

    class FE1,FE2,FE3,FE4 frontend;
    class R1,R2,R3 edge;
    class B1,B2,B3,B4,B5 backend;
    class M1,M2,M3,M4,M5,M6 model;
```

---

## 3) CHANGES.md Implementation Impact Map

```mermaid
flowchart LR
    CH[CHANGES.md] --> CH5[Section 5\nRepository Analysis + Reliability Hardening]
    CH --> CH4[Section 4\nFrontend Dependency Hardening]
    CH --> CH3[Section 3\nPubSub Instance Caching]
    CH --> CH2[Section 2\nEvacuation Event Emission]
    CH --> CH1[Section 1\nWebSocket Subscription Path]

    CH5 --> F1[model.js\nTEMP_DANGER_THRESHOLD\ndeferredEval naming]
    CH5 --> F2[schema.js\nValidation + partial updates + messages + deviceCount]
    CH5 --> F3[frontend/src/app.js\n/graphqlws + dynamic room rendering]
    CH5 --> F4[frontend/src/setupProxy.js\nExplicit WS proxy]
    CH5 --> F5[test/schema.mutations.test.js\nMutation behavior lock-in]
    CH5 --> F6[DEPENDENCY-REMEDIATION.md\nSafe-first + migration path]

    CH4 --> R1[package and lock changes]
    CH3 --> R2[Subscription scalability]
    CH2 --> R3[Real-time evac consistency]
    CH1 --> R4[Client-server route correctness]

    F1 --> O1[Configurable safety policy]
    F2 --> O2[Data integrity and safer input handling]
    F3 --> O3[Stable subscriptions and accurate room count]
    F5 --> O4[Regression prevention]
    F6 --> O5[Strategic reduction of CRA risk]

    classDef source fill:#f4f4f4,stroke:#666,stroke-width:2px,color:#111;
    classDef change fill:#e3f2fd,stroke:#1d3557,stroke-width:2px,color:#0b2545;
    classDef result fill:#e9fbe5,stroke:#2b9348,stroke-width:2px,color:#1b4332;

    class CH,CH1,CH2,CH3,CH4,CH5 source;
    class F1,F2,F3,F4,F5,F6,R1,R2,R3,R4 change;
    class O1,O2,O3,O4,O5 result;
```

---

## 4) Safety Mutation Lifecycle (What Happens on updateSensors)

```mermaid
sequenceDiagram
    autonumber
    participant Dashboard as Dashboard Client
    participant GQL as GraphQL Mutation Resolver
    participant Validate as validateSensorsInput
    participant Device as Device State Object
    participant Eval as deferredEval + evalDanger
    participant Graph as updateGraph
    participant Sub as Subscription Pipeline

    Dashboard->>GQL: updateSensors(id, sensors)
    GQL->>GQL: Validate device id range
    alt Invalid device id
        GQL-->>Dashboard: success=false, message="Invalid device id"
    else Valid id
        GQL->>Validate: Validate numeric and boolean bounds
        alt Validation fails
            Validate-->>GQL: Error message
            GQL-->>Dashboard: success=false, message=<reason>
        else Validation passes
            GQL->>Device: Apply only provided fields
            Device->>Eval: deferredEval()
            Eval->>Graph: updateGraph() when danger state changes
            Graph->>Sub: Emit state change events
            Sub-->>Dashboard: deviceChanged subscription update
            GQL-->>Dashboard: success=true
        end
    end
```

---

## 5) Dependency Strategy Roadmap for Mixed Audiences

```mermaid
flowchart LR
    S0[Current State\nCRA Toolchain Residual Vulnerabilities] --> S1[Phase 1\nSafe Non-Breaking Remediation]
    S1 --> S2[Phase 2\nMigration Decision]
    S2 --> V[Vite Migration Path]
    S2 --> N[Next.js Migration Path]
    V --> S3[Parity Validation\nQueries Mutations Subscriptions Build Deploy]
    N --> S3
    S3 --> S4[Lower Security Risk + Better Maintainability]

    M1[Marketing Outcome\nHigher confidence in system reliability] -.-> S4
    E1[Engineering Outcome\nModern toolchain + fewer inherited CVEs] -.-> S4

    classDef now fill:#ffe8e8,stroke:#c1121f,stroke-width:2px,color:#490a0a;
    classDef phase fill:#fff7d6,stroke:#ff9f1c,stroke-width:2px,color:#5f3b00;
    classDef option fill:#e8f0ff,stroke:#3a86ff,stroke-width:2px,color:#0b2545;
    classDef goal fill:#e6f7ef,stroke:#2a9d8f,stroke-width:2px,color:#0f3d2e;

    class S0 now;
    class S1,S2,S3 phase;
    class V,N option;
    class S4,M1,E1 goal;
```

## Suggested Usage

- Use Diagram 1 and Diagram 5 in cross-functional reviews.
- Use Diagram 2 and Diagram 4 in architecture and reliability discussions.
- Use Diagram 3 when walking through release notes and implementation traceability.
