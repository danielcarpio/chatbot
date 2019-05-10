import json
import math
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed
from sklearn import tree
from sklearn.tree.export import export_text
from sklearn.metrics import accuracy_score
from sklearn.preprocessing import LabelEncoder
from pandas import read_json
from pandas import DataFrame
from django.shortcuts import HttpResponse

class Tree(APIView):
    def get(self, request):
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
    
    def tratamiento_datos(self, data, null_data):
        if null_data["tipo"] == "sustituir":
            return self.sustitucion(data, null_data)
        elif null_data["tipo"] == "ignorar":
            return self.ignorar(data)
        
    def sustitucion(self, data, null_data):
        res = DataFrame.copy(data)
        for c in res.columns.values:
            if res[c].isnull().values.any():
                for v in range(0, len(res[c])):
                    if not type(res[c][v]) is str and math.isnan(res[c][v]):
                        res[c][v] = null_data['valores'][c]
        return res

    def ignorar(self, data):
        res = DataFrame.copy(data)
        for i in res.iterrows():
            if i[1].isnull().values.any():
                res = res.drop(i[0])
        return res

    def post(self, request):
        file = request.FILES['archivo']
        col = request.POST.get('columna_objetivo')
        max_depth = request.POST.get('profundidad')
        null_data = request.POST.get('datos_null')

        if col == None or col == "":
            return Response(status=status.HTTP_400_BAD_REQUEST)

        data = read_json(file)

        if data.isnull().values.any():
            if not null_data is None:
                data = self.tratamiento_datos(data, json.loads(null_data))
            else:
                data = self.ignorar(data)

        if not col in data.columns.values:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if max_depth is None or max_depth == 0 or max_depth < 0:
            clf = tree.DecisionTreeClassifier()
        else:
            clf = tree.DecisionTreeClassifier(max_depth=max_depth)

        labels_encoders = {}
        for d in data:
            le = LabelEncoder()
            le.fit(data[d])
            labels_encoders[d] = le
            data[d] = le.transform(data[d])
        
        x = DataFrame.copy(data).drop(col, axis=1)
        y = DataFrame.copy(data).drop(data.columns.difference([col]), axis=1)

        clf.fit(x, y)

        tree_text = export_text(clf)
        
        return Response({'tree': tree_text}, status=status.HTTP_200_OK)