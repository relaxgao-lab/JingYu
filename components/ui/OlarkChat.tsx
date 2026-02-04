"use client"

import React, { useEffect } from 'react';

const OlarkChat = () => {

  useEffect(() => {
    

    
    // 检查 Olark 是否已经初始化
    // if ((window as any).olark && typeof (window as any).olark === 'function') {
    //   console.log('Olark already initialized');
      
    //   return;
    // }
    // Olark initialization code
    const loadOlark = async ()=>{
      (window as any).olark || (function(c: any) {
        var f = window as any;
        var d = document;
        var l = f.location.protocol === "https:" ? "https:" : "http:";
        var z = c.name as string;
        var r = "load";
  
        var nt = function() {
          f[z] = function() {
            (a.s = a.s || []).push(arguments);
          };
          var a = f[z]._ = {} as any;
          var q = c.methods.length;
  
          while (q--) {
            (function(n) {
              f[z][n] = function() {
                (f[z] as any)("call", n, arguments);
              };
            })(c.methods[q]);
          }
  
          a.l = c.loader;
          a.i = nt;
          a.p = { 0: +new Date() };
          a.P = function(u: number) {
            a.p[u] = new Date().getTime() - a.p[0];
          };
  
          function s() {
            a.P(r);
            (f[z] as Function)(r);
          }
  
          if (f.addEventListener) {
            f.addEventListener(r, s, false);
          } else {
            f.attachEvent("on" + r, s);
          }
  
          var ld = function() {
            function p(hd: string) {
              hd = "head";
              return [
                "<", hd, "></", hd, "><", i, ' onl' + 'oad="var d=', g,
                ";d.getElementsByTagName('head')[0].", j, "(d.", h,
                "('script')).", k, "='", l, "//", a.l, "'", '"', "></", i, ">"
              ].join("");
            }
  
            var i = "body";
            var m = d.body; // 使用 d.body 替代 d[i]
            if (!m) {
              return setTimeout(ld, 100);
            }
  
            a.P(1);
            var j = "appendChild";
            var h = "createElement";
            var k = "src";
            var n = d.createElement("div");
            var v = n.appendChild(d.createElement(z));
            var b = d.createElement("iframe") as HTMLIFrameElement;
            var g = "document";
            var e = "domain";
            var o;
  
            n.style.display = "none";
            m.insertBefore(n, m.firstChild).id = z;
            b.frameBorder = "0";
            b.id = z + "-loader";
  
            if (/MSIE[ ]+6/.test(navigator.userAgent)) {
              b.src = "javascript:false";
            }
  
            b.style.backgroundColor = "transparent";  // 设置透明背景
            v.appendChild(b);
  
            try {
              (b.contentWindow as any)[g].open();
            } catch (w) {
              c[e] = d.domain;
              o = "javascript:var d=" + g + ".open();d.domain='" + d.domain + "';";
              b.src = o + "void(0);";
            }
  
            try {
              var t = (b.contentWindow as any)[g];
              t.write(p(''));
              t.close();
            } catch (x) {
              b.src = o + 'd.write("' + p('').replace(/"/g, String.fromCharCode(92) + '"') + '");d.close();';
            }
  
            a.P(2);
          };
  
          ld();
        };
  
        nt();
      })({
        loader: "static.olark.com/jsclient/loader0.js",
        name: "olark",
        methods: ["configure", "extend", "declare", "identify"]
      });
    }
   
    const initOlark = async () => {
      await loadOlark();
     

      // Custom configuration
      (window as any).olark?.identify('5263-394-10-4492');
      // (window as any).olark.configure('CalloutBubble.bubble_height', 20);
      // updateOlark(locale);
      (window as any).olark?.('api.box.onShow', () => {
        //不知道为什么 需要延迟两秒钟调用才生效
      
      
      });
    };

    initOlark(); 
    // (window as any).olark.identify('5263-394-10-4492');
    // (window as any).olark.configure('CalloutBubble.bubble_height', 20 )
  }, []);

  return null;
};

export default OlarkChat;
