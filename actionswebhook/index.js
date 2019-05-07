'use strict';

const {dialogflow} = require('actions-on-google');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');

const app = dialogflow({debug: true});

var prueba = {
    atributo: "cielo",
    ramas: [
        {
            valor: "soleado",
            siguiente: {
                atributo: "humedad",
                ramas: [
                    {
                        valor: "alta",
                        siguiente: "no"
                    },
                    {
                        valor: "baja",
                        siguiente: "si"
                    }
                ]
            }
        },
        {
            valor: "nublado",
            siguiente: "si"
        },
        {
            valor: "lluvia",
            siguiente: {
                atributo: "viento",
                ramas: [
                    {
                        valor: "debil",
                        siguiente: "si"
                    },
                    {
                        valor: "fuerte",
                        siguiente: "no"
                    }
                ]
            }
        }
    ]
}

function hacerPregunta(conv) {
    var estado = conv.data.estado;
    if (!estado || !estado.atributo) {
        conv.close('Lo siento, hubo un problema.');
    } else if (estado.atributo === 'cielo') {
        conv.contexts.set('cielo', 5);
        conv.contexts.set('humedad', 0);
        conv.contexts.set('temperatura', 0);
        conv.contexts.set('viento', 0);
        conv.ask(cadenaAleatoria([
            'Dime cómo está el cielo.',
            'Por favor, dime cómo está el cielo ahora.'
        ]));
    } else if (estado.atributo === 'humedad') {
        conv.contexts.set('cielo', 0);
        conv.contexts.set('humedad', 5);
        conv.contexts.set('temperatura', 0);
        conv.contexts.set('viento', 0);
        conv.ask(cadenaAleatoria([
            'Dime cómo está la humedad.',
            'Por favor, dime la humedad que hace ahora.'
        ]));
    } else if (estado.atributo === 'temperatura') {
        conv.contexts.set('cielo', 0);
        conv.contexts.set('humedad', 0);
        conv.contexts.set('temperatura', 5);
        conv.contexts.set('viento', 0);
        conv.ask(cadenaAleatoria([
            'Dime cómo está la temperatura.',
            'Por favor, dime qué temperatura hace.'
        ]));
    } else if (estado.atributo === 'viento') {
        conv.contexts.set('cielo', 0);
        conv.contexts.set('humedad', 0);
        conv.contexts.set('temperatura', 0);
        conv.contexts.set('viento', 5);
        conv.ask(cadenaAleatoria([
            'Dime cómo está el viento.',
            'Por favor, dime cómo está el viento ahora.'
        ]));
    }
}

function procesarRespuesta(conv, valor) {
    conv.data.estado = conv.data.estado.ramas.find(rama => rama.valor === valor).siguiente;
    if (conv.data.estado === 'no') {
        conv.close(cadenaAleatoria([
            'Es mejor que hoy no salgas a jugar.',
            'Te recomiendo que no juegues hoy.'
        ]));
    } else if (conv.data.estado === 'si') {
        conv.close(cadenaAleatoria([
            '¡Estupendo! Hoy puedes salir a jugar.',
            'Hoy hace un día perfecto para jugar.'
        ]));
    } else if (typeof conv.data.estado === 'object') {
        hacerPregunta(conv);
    }
}

function cadenaAleatoria(cadenas) {
    return cadenas[Math.floor(Math.random()*cadenas.length)];
}

app.intent('pregjugar', (conv, {}) => {
    conv.data.estado = JSON.parse(JSON.stringify(prueba));
    hacerPregunta(conv);
});

app.intent('pregviento', (conv, {intviento}) => {
    procesarRespuesta(conv, intviento);
});

app.intent('pregtemperatura', (conv, {temperatura}) => {
    procesarRespuesta(conv, temperatura);
});

app.intent('pregcielo', (conv, {cielo}) => {
    procesarRespuesta(conv, cielo);
});

app.intent('preghumedad', (conv, {humedad}) => {
    procesarRespuesta(conv, humedad);
});

const expressApp = express().use(bodyParser.json());

expressApp.post('/fulfillment', app);

expressApp.listen(process.env.PORT || 3000);