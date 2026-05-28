// jsdom does not implement HTMLDialogElement.showModal / close in all
// versions we target. Provide a minimal polyfill that is good enough
// for behavior tests: tracks an `open` attribute and a `returnValue`,
// fires the `close` event when close() is called.
//
// Import this file at the top of any test that exercises a <dialog>.

if (typeof HTMLDialogElement !== 'undefined') {
  const proto = HTMLDialogElement.prototype;

  if (typeof proto.showModal !== 'function' || proto.showModal.toString().includes('not implemented')) {
    proto.showModal = function showModal() {
      this.setAttribute('open', '');
    };
  }

  if (typeof proto.show !== 'function' || proto.show.toString().includes('not implemented')) {
    proto.show = function show() {
      this.setAttribute('open', '');
    };
  }

  if (typeof proto.close !== 'function' || proto.close.toString().includes('not implemented')) {
    proto.close = function close(returnValue) {
      this.removeAttribute('open');
      if (typeof returnValue === 'string') {
        this.returnValue = returnValue;
      }
      this.dispatchEvent(new Event('close'));
    };
  }
}
