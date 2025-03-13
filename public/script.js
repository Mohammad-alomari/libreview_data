let myChart = null;
let glucoseData = []; // Store fetched data for CSV export

document.addEventListener('DOMContentLoaded', async () => {
    let userId = localStorage.getItem('vital_user_id');
    let clientUserId = localStorage.getItem('vital_client_user_id');

    if (!clientUserId) {
        clientUserId = 'user-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('vital_client_user_id', clientUserId);
    }

    if (!userId) {
        try {
            const checkResponse = await fetch('/check-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientUserId: clientUserId }),
            });
            const checkData = await checkResponse.json();

            if (checkData.exists) {
                userId = checkData.user_id;
                localStorage.setItem('vital_user_id', userId);
                console.log('Existing user found with ID:', userId);
            } else {
                const createResponse = await fetch('/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientUserId: clientUserId }),
                });
                const createData = await createResponse.json();
                userId = createData.userId;
                localStorage.setItem('vital_user_id', userId);
                console.log('User created with ID:', userId);
            }
        } catch (error) {
            console.error('Error checking/creating user:', error);
            document.getElementById('auth-status').textContent = 'Error: Could not initialize user.';
            return;
        }
    } else {
        console.log('User ID loaded from storage:', userId);
    }

    document.getElementById('connect-btn').addEventListener('click', async () => {
        const status = document.getElementById('auth-status');
        if (!userId) {
            status.textContent = 'Error: User not initialized.';
            return;
        }

        status.textContent = 'Generating link token...';

        try {
            const response = await fetch('/generate-link-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId }),
            });
            const data = await response.json();

            if (data.linkWebUrl) {
                status.textContent = 'Redirecting to authenticate...';
                window.location.href = data.linkWebUrl;
            } else {
                status.textContent = 'Error: No link URL received.';
            }
        } catch (error) {
            status.textContent = 'Error: Could not connect. Please try again.';
            console.error(error);
        }
    });

    document.getElementById('data-section').style.display = 'block';

    document.getElementById('data-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const startDate = new Date(document.getElementById('start-date').value);
        const endDate = new Date(document.getElementById('end-date').value);
        const output = document.getElementById('data-output');

        if (!userId) {
            output.textContent = 'Error: User not initialized.';
            return;
        }

        output.textContent = 'Fetching data...';

        try {
            const response = await fetch(
                `/fetch-glucose-data?user_id=${userId}&start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`
            );
            const data = await response.json();
            console.log(data);

            if (data.groups && data.groups.abbott_libreview && data.groups.abbott_libreview.length > 0) {
                glucoseData = [];
                let labels = [];

                data.groups.abbott_libreview.forEach(group => {
                    group.data.forEach(entry => {
                        let utcTime;

                        if (entry.timestamp) {
                            utcTime = new Date(entry.timestamp);
                            if (isNaN(utcTime)) {
                                utcTime = new Date(entry.timestamp + 'Z');
                            }
                        }

                        if (!isNaN(utcTime)) {
                            labels.push(utcTime);
                            glucoseData.push({ timestamp: utcTime, value: entry.value });
                        }
                    });
                });

                labels.sort((a, b) => a - b);
                glucoseData.sort((a, b) => a.timestamp - b.timestamp);

                const formattedLabels = labels.map(date => {
                    return date.toISOString().replace('T', ' ').substring(0, 16);
                });

                const ctx = document.getElementById('glucoseChart').getContext('2d');
                if (myChart !== null) {
                    myChart.destroy();
                }

                myChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: formattedLabels,
                        datasets: [
                            {
                                label: 'Glucose Readings',
                                data: glucoseData.map(entry => entry.value),
                                borderColor: 'blue',
                                backgroundColor: 'rgba(0, 0, 255, 0.2)',
                                borderWidth: 2,
                                fill: true,
                                cubicInterpolationMode: 'monotone',
                                tension: 0.4
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            x: {
                                type: 'category',
                                title: { display: true, text: 'Timestamp (UTC)' },
                                ticks: {
                                    autoSkip: true,
                                    maxTicksLimit: 10
                                }
                            },
                            y: {
                                title: { display: true, text: 'Glucose Level (mmol/L)' }
                            }
                        }
                    }
                });

                document.getElementById('download-csv').style.display = 'block';
                output.textContent = '';
            } else {
                output.textContent = 'No data found for the selected range. Or no glucose data available.';
            }
        } catch (error) {
            output.textContent = 'Error: Could not fetch data. Please try again.';
            console.error(error);
        }
    });

    document.getElementById('download-csv').addEventListener('click', () => {
        if (glucoseData.length === 0) {
            alert('No data available for download.');
            return;
        }

        let csvContent = 'Timestamp (UTC),Glucose Level (mmol/L)\n';
        glucoseData.forEach(entry => {
            csvContent += `${entry.timestamp.toISOString()},${entry.value}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `glucose_data_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
});
