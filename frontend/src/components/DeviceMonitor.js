import React from 'react';
import { gql, useQuery } from '@apollo/client';

const GET_DEVICE = gql`
  query GetDevice($id: Int!) {
    model {
      getDevice(id: $id) {
        danger
        occupied
        temperature
        humidity
        airQuality
        ledState
        evacState
        smokeDetected
      }
    }
  }
`;

const SUB_DEVICE = gql`
  subscription MySubscription($id: Int!) {
    deviceChanged(id: $id) {
      danger
      occupied
      temperature
      humidity
      airQuality
      ledState
      evacState
      smokeDetected
    }
  }
`;

function DeviceMonitor({ deviceId }) {
  const { loading, error, data, subscribeToMore } = useQuery(GET_DEVICE, {
    variables: { id: deviceId },
    // pollInterval: 1000, // Poll every second for updates
  });

  React.useEffect(() => {
    const unsubscribe = subscribeToMore({
      document: SUB_DEVICE,
      variables: { id: deviceId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;
        return Object.assign({}, prev, {model: Object.assign({}, prev.model, {getDevice: subscriptionData.data.deviceChanged})});
      },
    });

    return () => {
      unsubscribe();
    };
  }, [deviceId, subscribeToMore]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  const device = data.model.getDevice;
  if (!device) return <p>Device {deviceId} not found</p>;

  return (
    <div className="room-card alert">
        <h2>Room {deviceId+1}</h2>
        { device.danger
            ? <div className="status alert-text"><img src="../UI_Icons/Red_Alert_Icon.png" width="5px" alt="" aria-hidden="true"/> ALERT</div>
            : <div className="status normal-text"><img src="../UI_Icons/Green_Alert_Icon.png" width="5px" alt="" aria-hidden="true"/>  NORMAL</div>}
        
        <div className="info">
          <p>Smoke Detected: <strong>{device.smokeDetected === null ? 'Unknown' : device.smokeDetected ? 'Yes' : 'No'}</strong></p>
          <p><img src="../UI_Icons/People_Count_Icon.png" width="20px" alt="" aria-hidden="true"/> Occupied: {device.occupied === null ? 'Unknown' : device.occupied ? 'Yes' : 'No'}</p>
          <p><img src="../UI_Icons/Temperature_Icon.png" width="10px" alt="" aria-hidden="true"/> Temperature: {device.temperature !== null ? `${device.temperature}°C` : 'N/A'}</p>
          <p><img src="../UI_Icons/Humidity_Icon.png" width="10px" alt="" aria-hidden="true"/> Humidity: {device.humidity !== null ? `${device.humidity}%` : 'N/A'}</p>
          <p><img src="../UI_Icons/Emergency_Door_Icon.png" width="20px" alt="" aria-hidden="true"/> State: <span className={`evac-state ${device.evacState}`}>{device.evacState === 'EVAC' ? 'Evacuating' : "Safe"}</span></p>
        </div>
      </div>
    /* <div className="device-monitor">
      <h2>Device {deviceId}</h2>
      <div className={`status ${device.danger ? 'danger' : 'normal'}`}>
        {device.danger ? '⚠️ DANGER' : '✓ Normal'}
      </div>
      
      <div className="metrics">
        <div className="metric">
          <label>Occupied:</label>
          <span>{device.occupied === null ? 'Unknown' : device.occupied ? 'Yes' : 'No'}</span>
        </div>
        
        <div className="metric">
          <label>Temperature:</label>
          <span>{device.temperature !== null ? `${device.temperature}°` : 'N/A'}</span>
        </div>
        
        <div className="metric">
          <label>Humidity:</label>
          <span>{device.humidity !== null ? `${device.humidity}%` : 'N/A'}</span>
        </div>
        
        <div className="metric">
          <label>Air Quality:</label>
          <span>{device.airQuality !== null ? device.airQuality : 'N/A'}</span>
        </div>
      </div>
      
      <div className="states">
        <div className="state">
          <label>LED State:</label>
          <span className={`led-state ${device.ledState}`}>{device.ledState}</span>
        </div>
        
        <div className="state">
          <label>Evacuation State:</label>
          <span className={`evac-state ${device.evacState}`}>{device.evacState}</span>
        </div>
      </div>
    </div> */
  );
}

export default DeviceMonitor;