
const axios = require('axios');

async function request() {

    const endpoint = '/v1/completions';
    const url = `http://127.0.0.1:5000${endpoint}`;

    let prompt = '日本の首都は？';

    const payload = {
        'prompt': prompt,
        'max_tokens': 4092,
        'temperature': 0.7,
        'temperature_last': false,
        'dynamic_temperature': false,
        'dynatemp_low': 1,
        'dynatemp_high': 1,
        'dynatemp_exponent': 1,
        'smoothing_factor': 0,
        'top_p': 0.9,
        'min_p': 0,
        'top_k': 20,
        'repetition_penalty': 1.15,
        'presence_penalty': 0,
        'frequency_penalty': 0,
        'repetition_penalty_range': 1024,
        'typical_p': 1,
        'tfs': 1,
        'top_a': 0,
        'epsilon_cutoff': 0,
        'eta_cutoff': 0,
        'guidance_scale': 1,
        'penalty_alpha': 0,
        'mirostat_mode': 0,
        'mirostat_tau': 5,
        'mirostat_eta': 0.1,
        'do_sample': true,
        'seed': -1,
        'encoder_repetition_penalty': 1,
        'no_repeat_ngram_size': 0,
        'min_length': 0,
        'num_beams': 1,
        'length_penalty': 1,
        'early_stopping': false,
        'sampler_priority': 'temperature\ndynamic_temperature\nquadratic_sampling\ntop_k\ntop_p\ntypical_p\nepsilon_cutoff\neta_cutoff\ntfs\ntop_a\nmin_p\nmirostat'
    };

    const config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };


    try {
        const response = await axios.post(url, payload, config);

        console.log(response);
        console.log(response.data.choices[0].text);

    } catch (error) {
        console.error(error);
    }
}

request();