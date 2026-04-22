import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import schema from '../schema.js';
import { model, EVACStates, LEDStates } from '../model.js';

function resetDevice(device) {
  device.danger = false;
  device.occupied = null;
  device.temperature = null;
  device.humidity = null;
  device.airQuality = null;
  device.ledState = LEDStates.SAFE;
  device.evacState = EVACStates.NORMAL;
  device.smokeDetected = null;
  device.forcedDanger = null;
  device.forcedOccupancy = null;
}

function resetModel() {
  model.devices.forEach(resetDevice);
}

async function executeMutation(source, variables) {
  return graphql({ schema, source, variableValues: variables });
}

test.beforeEach(() => {
  resetModel();
});

test('updateSensors keeps existing values on partial updates', async () => {
  const updateMutation = `
    mutation Update($id: Int!, $sensors: DeviceSensors!) {
      updateSensors(id: $id, sensors: $sensors) {
        success
        message
      }
    }
  `;

  const firstUpdate = await executeMutation(updateMutation, {
    id: 0,
    sensors: { temperature: 40, humidity: 55 },
  });

  assert.equal(firstUpdate.errors, undefined);
  assert.equal(firstUpdate.data.updateSensors.success, true);

  const partialUpdate = await executeMutation(updateMutation, {
    id: 0,
    sensors: { temperature: 65 },
  });

  assert.equal(partialUpdate.errors, undefined);
  assert.equal(partialUpdate.data.updateSensors.success, true);

  const queryResult = await graphql({
    schema,
    source: `
      query Device($id: Int!) {
        model {
          getDevice(id: $id) {
            temperature
            humidity
          }
        }
      }
    `,
    variableValues: { id: 0 },
  });

  assert.equal(queryResult.errors, undefined);
  assert.equal(queryResult.data.model.getDevice.temperature, 65);
  assert.equal(queryResult.data.model.getDevice.humidity, 55);
});

test('updateSensors rejects out-of-range values with message', async () => {
  const result = await executeMutation(
    `
      mutation Update($id: Int!, $sensors: DeviceSensors!) {
        updateSensors(id: $id, sensors: $sensors) {
          success
          message
        }
      }
    `,
    {
      id: 0,
      sensors: { humidity: 150 },
    },
  );

  assert.equal(result.errors, undefined);
  assert.equal(result.data.updateSensors.success, false);
  assert.match(result.data.updateSensors.message, /humidity must be between 0 and 100/);
});

test('updateSensors rejects invalid device id', async () => {
  const result = await executeMutation(
    `
      mutation Update($id: Int!, $sensors: DeviceSensors!) {
        updateSensors(id: $id, sensors: $sensors) {
          success
          message
        }
      }
    `,
    {
      id: -1,
      sensors: { temperature: 20 },
    },
  );

  assert.equal(result.errors, undefined);
  assert.equal(result.data.updateSensors.success, false);
  assert.equal(result.data.updateSensors.message, 'Invalid device id');
});
