export interface BasicEvent {
    name: string;
    time: string;
    [key: string]: any;
}

export const sendEvent = (event: BasicEvent) => {
    const req = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            event: event
        }),
    };

    fetch('http://localhost:8070/send-event', req)
        .then(response => response.json())
        .then(data => {
            console.log("Log recorded", data);
        })
        .catch((error) => {
            console.error('Error occurred when recording log:', error);
        });
}
