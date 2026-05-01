import { GraphQLSchema, GraphQLString, GraphQLObjectType, GraphQLInt, GraphQLNonNull, GraphQLBoolean, GraphQLFloat, GraphQLEnumType, GraphQLInputObjectType } from 'graphql';
import { model, EVACStates, LEDStates } from './model.js';
import { PubSub } from 'graphql-subscriptions';

const pubsubCache = new Map();
function getPubSub(device) {
  if (!pubsubCache.has(device)) {
    pubsubCache.set(device, new PubSub({eventEmitter: device}));
  }
  return pubsubCache.get(device);
}

const SENSOR_LIMITS = Object.freeze({
  temperature: { min: -50, max: 200 },
  humidity: { min: 0, max: 100 },
  airQuality: { min: 0, max: 1000 },
});

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateSensorsInput(sensors) {
  for (const [field, limits] of Object.entries(SENSOR_LIMITS)) {
    const value = sensors[field];
    if (value === undefined || value === null) continue;
    if (!isFiniteNumber(value)) {
      return `${field} must be a finite number`;
    }
    if (value < limits.min || value > limits.max) {
      return `${field} must be between ${limits.min} and ${limits.max}`;
    }
  }
  if (sensors.occupied !== undefined && sensors.occupied !== null && typeof sensors.occupied !== 'boolean') {
    return 'occupied must be a boolean';
  }
  if (sensors.smokeDetected !== undefined && sensors.smokeDetected !== null && typeof sensors.smokeDetected !== 'boolean') {
    return 'smokeDetected must be a boolean';
  }
  return null;
}

const EVACStatesType = new GraphQLEnumType({
  name: "EVACStates",
  values: {
    NORMAL: { value: EVACStates.NORMAL },
    EVAC: { value: EVACStates.EVAC },
  }
});

const LEDStatesType = new GraphQLEnumType({
  name: "LEDStates",
  values: {
    OFF: { value: LEDStates.OFF },
    SAFE: { value: LEDStates.SAFE },
    EVAC_LEFT: { value: LEDStates.EVAC_LEFT },
    EVAC_RIGHT: { value: LEDStates.EVAC_RIGHT },
    DANGER: { value: LEDStates.DANGER },
  }
});

const DeviceType = new GraphQLObjectType({
  name: 'Device',
  fields: {
    danger: { type: new GraphQLNonNull(GraphQLBoolean) },
    occupied: { type: GraphQLBoolean },
    temperature: { type: GraphQLFloat },
    humidity: { type: GraphQLFloat },
    airQuality: { type: GraphQLFloat },
    ledState: { type: new GraphQLNonNull(LEDStatesType) },
    evacState: { type: new GraphQLNonNull(EVACStatesType) },
    smokeDetected: { type: GraphQLBoolean },
    forcedOccupancy: { type: GraphQLBoolean },
    forcedDanger: { type: GraphQLBoolean },
  }
});

const DeviceSensorsType = new GraphQLInputObjectType({
  name: 'DeviceSensors',
  fields: {
    occupied: { type: GraphQLBoolean },
    temperature: { type: GraphQLFloat },
    humidity: { type: GraphQLFloat },
    airQuality: { type: GraphQLFloat },
    smokeDetected: { type: GraphQLBoolean },
  }
});

const ModelType = new GraphQLObjectType({
  name: 'Model',
  fields: {
    deviceCount: {
      type: new GraphQLNonNull(GraphQLInt),
      resolve: obj => obj.devices.length,
    },
    getDevice: {
      type: DeviceType,
      args: { id: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (obj, {id}) => {
        if (0 <= id && id < obj.devices.length) {
          return obj.devices[id];
        }
      }
    }
  }
});

const MutationReturnType = new GraphQLObjectType({
  name: 'MutationReturn',
  fields: {
    success: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: obj => obj.success,
    },
    message: {
      type: GraphQLString,
      resolve: obj => obj.message ?? null,
    }
  }
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      model: {
        type: new GraphQLNonNull(ModelType),
        resolve: () => model,
      }
    }
  }),
  mutation: new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      updateSensors: {
        type: MutationReturnType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLInt) },
          sensors: { type: new GraphQLNonNull(DeviceSensorsType) }
        },
        resolve: (_, {id, sensors}) => {
          if (!(0 <= id && id < model.devices.length)) {
            return {success: false, message: 'Invalid device id'};
          }
          const validationError = validateSensorsInput(sensors);
          if (validationError) {
            return {success: false, message: validationError};
          }
          let device = model.devices[id];
          if (sensors.occupied !== undefined) device.occupied = sensors.occupied;
          if (sensors.temperature !== undefined) device.temperature = sensors.temperature;
          if (sensors.humidity !== undefined) device.humidity = sensors.humidity;
          if (sensors.airQuality !== undefined) device.airQuality = sensors.airQuality;
          if (sensors.smokeDetected !== undefined) device.smokeDetected = sensors.smokeDetected;
          device.deferredEval();
          return {success: true};
        }
      },
      forceOccupancy: {
        type: MutationReturnType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLInt) },
          value: { type: GraphQLBoolean }
        },
        resolve: (_, {id, value}) => {
          if (0 <= id && id < model.devices.length) {
            let device = model.devices[id];
            device.forcedOccupancy = value;
            device.deferredEval();
            return {success: true};
          }
          return {success: false, message: 'Invalid device id'};
        }
      },
      forceDanger: {
        type: MutationReturnType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLInt) },
          value: { type: GraphQLBoolean }
        },
        resolve: (_, {id, value}) => {
          if (0 <= id && id < model.devices.length) {
            let device = model.devices[id];
            device.forcedDanger = value;
            device.deferredEval();
            return {success: true};
          }
          return {success: false, message: 'Invalid device id'};
        }
      }
    }
  }),
  subscription: new GraphQLObjectType({
    name: 'Subscription',
    fields: {
      greetings: {
        type: GraphQLString,
        description: "greetings is for example purposes only.",
        subscribe: async function* () {
          for (const hi of ['Hi', 'Bonjour', 'Hola', 'Ciao', 'Zdravo']) {
            yield { greetings: hi };
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        },
      },
      deviceChanged: {
        type: DeviceType,
        args: { id: { type: new GraphQLNonNull(GraphQLInt) } },
        resolve: obj => obj,
        subscribe: (_, {id}) => {
          if (0 <= id && id < model.devices.length) {
            let pubsub = getPubSub(model.devices[id]);
            return pubsub.asyncIterableIterator("deviceChanged");
          }
          throw new Error(`Invalid device id: ${id}`);
        }
      },
      ledStateChanged: {
        type: LEDStatesType,
        args: { id: { type: new GraphQLNonNull(GraphQLInt) } },
        resolve: obj => obj,
        subscribe: (_, {id}) => {
          if (0 <= id && id < model.devices.length) {
            let pubsub = getPubSub(model.devices[id]);
            return pubsub.asyncIterableIterator("ledStateChanged");
          }
          throw new Error(`Invalid device id: ${id}`);
        }
      }
    }
  }),
});

export default schema;
